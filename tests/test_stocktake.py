"""核心业务逻辑测试：导入、录入、重复扫码保护、差异分组、复盘与导出。"""
import pytest

from stocktake import DuplicateCountError, ImportError_, Stocktake, UnknownSkuError

CSV = """货号,名称,类别,货架,账面数量
A001,可乐,饮料,A架,24
A002,雪碧,饮料,A架,18
B001,薯片,零食,B架,15
"""


def make_store():
    store = Stocktake()
    store.import_csv(CSV)
    return store


def test_import_csv_chinese_headers():
    store = make_store()
    assert store.summary()["total"] == 3
    p = store.products["A001"]
    assert (p.name, p.category, p.shelf, p.system_qty) == ("可乐", "饮料", "A架", 24)


def test_import_english_headers_and_bom():
    store = Stocktake()
    store.import_csv("﻿sku,name,category,shelf,system_qty\nX1,Item,Cat,S1,5\n")
    assert store.products["X1"].system_qty == 5


def test_import_replaces_previous_session():
    store = make_store()
    store.record_count("A001", 20)
    store.import_csv("货号,名称,类别,货架,账面数量\nZ9,新品,杂,Z架,3\n")
    assert store.summary()["total"] == 1
    assert store.products["Z9"].actual_qty is None


def test_import_invalid_rows_rejected_and_session_kept():
    store = make_store()
    with pytest.raises(ImportError_):
        store.import_csv("货号,名称,类别,货架,账面数量\nA009,坏行,杂,Z架,abc\n")
    assert store.summary()["total"] == 3  # 导入失败不破坏原数据


def test_import_duplicate_sku_rejected():
    store = Stocktake()
    with pytest.raises(ImportError_):
        store.import_csv("货号,名称,类别,货架,账面数量\nA1,甲,杂,Z架,1\nA1,乙,杂,Z架,2\n")


def test_record_count_and_diff():
    store = make_store()
    store.record_count("A001", 20)
    assert store.products["A001"].diff == -4
    assert store.summary()["counted"] == 1


def test_duplicate_scan_does_not_overwrite_silently():
    store = make_store()
    store.record_count("A001", 20)
    with pytest.raises(DuplicateCountError) as exc:
        store.record_count("A001", 22)
    assert exc.value.existing_qty == 20
    assert store.products["A001"].actual_qty == 20  # 原数量保持不变


def test_duplicate_scan_overwrite_requires_explicit_flag():
    store = make_store()
    store.record_count("A001", 20)
    store.record_count("A001", 22, overwrite=True)
    assert store.products["A001"].actual_qty == 22


def test_unknown_sku_rejected():
    store = make_store()
    with pytest.raises(UnknownSkuError):
        store.record_count("NOPE", 1)


def test_negative_qty_rejected():
    store = make_store()
    with pytest.raises(ValueError):
        store.record_count("A001", -1)


def test_diffs_grouped_by_shelf_and_category():
    store = make_store()
    store.record_count("A001", 20)  # -4
    store.record_count("A002", 18)  # 0
    store.record_count("B001", 17)  # +2
    by_shelf = {g["group"]: g for g in store.diffs_by("shelf")}
    assert by_shelf["A架"]["diff_qty"] == -4
    assert by_shelf["A架"]["diff_items"] == 1
    assert by_shelf["B架"]["diff_qty"] == 2
    by_cat = {g["group"]: g for g in store.diffs_by("category")}
    assert by_cat["饮料"]["diff_qty"] == -4
    assert by_cat["零食"]["diff_qty"] == 2


def test_review_rows_sorted_by_abs_diff():
    store = make_store()
    store.record_count("A001", 20)  # -4
    store.record_count("A002", 18)  # 0，不进复盘表
    store.record_count("B001", 25)  # +10
    rows = store.review_rows()
    assert [r["sku"] for r in rows] == ["B001", "A001"]


def test_reason_and_export_csv():
    store = make_store()
    store.record_count("A001", 20)
    store.set_reason("A001", "临期下架")
    csv_text = store.export_counts_csv()
    assert "差异原因" in csv_text.splitlines()[0]
    assert "A001,可乐,饮料,A架,24,20,-4,临期下架" in csv_text
    review_csv = store.export_review_csv()
    assert "A001" in review_csv
    assert "A002" not in review_csv  # 无差异不进复盘表
