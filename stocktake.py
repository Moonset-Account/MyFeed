"""盘点差异助手 - 核心业务逻辑（纯 Python，不依赖 Web 框架）。

数据保存在内存中：一次盘点会话 = 一份商品清单 + 实盘录入 + 差异原因。
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field


class DuplicateCountError(Exception):
    """同一商品已录入实盘数量，重复扫码/录入时不允许悄悄覆盖。"""

    def __init__(self, sku: str, existing_qty: int, new_qty: int):
        self.sku = sku
        self.existing_qty = existing_qty
        self.new_qty = new_qty
        super().__init__(f"商品 {sku} 已录入数量 {existing_qty}，新数量 {new_qty} 需确认后才会覆盖")


class UnknownSkuError(Exception):
    def __init__(self, sku: str):
        self.sku = sku
        super().__init__(f"商品 {sku} 不在清单中")


class ImportError_(Exception):
    """CSV 导入格式错误。"""


# 支持的表头别名（中文/英文）
_HEADER_ALIASES = {
    "sku": ["sku", "货号", "条码", "编码", "商品编码"],
    "name": ["name", "名称", "商品名称", "品名"],
    "category": ["category", "类别", "分类", "商品类别"],
    "shelf": ["shelf", "货架", "货位", "货架号"],
    "system_qty": ["system_qty", "账面数量", "账面库存", "系统数量", "库存"],
}


@dataclass
class Product:
    sku: str
    name: str
    category: str
    shelf: str
    system_qty: int
    actual_qty: int | None = None
    reason: str = ""

    @property
    def counted(self) -> bool:
        return self.actual_qty is not None

    @property
    def diff(self) -> int | None:
        if self.actual_qty is None:
            return None
        return self.actual_qty - self.system_qty

    def to_dict(self) -> dict:
        return {
            "sku": self.sku,
            "name": self.name,
            "category": self.category,
            "shelf": self.shelf,
            "system_qty": self.system_qty,
            "actual_qty": self.actual_qty,
            "counted": self.counted,
            "diff": self.diff,
            "reason": self.reason,
        }


@dataclass
class Stocktake:
    products: dict[str, Product] = field(default_factory=dict)
    order: list[str] = field(default_factory=list)

    # ---- 清单管理 ----
    def reset(self) -> None:
        self.products.clear()
        self.order.clear()

    def add_product(self, sku: str, name: str, category: str, shelf: str, system_qty: int) -> None:
        sku = sku.strip()
        if not sku:
            raise ImportError_("存在缺少货号的行")
        if system_qty < 0:
            raise ImportError_(f"商品 {sku} 账面数量不能为负数")
        if sku in self.products:
            raise ImportError_(f"清单中货号重复：{sku}")
        self.products[sku] = Product(sku=sku, name=name.strip(), category=category.strip() or "未分类",
                                     shelf=shelf.strip() or "未分配", system_qty=system_qty)
        self.order.append(sku)

    def import_csv(self, text: str) -> dict:
        """导入商品清单 CSV。导入会清空当前会话，重新开始一次盘点。"""
        text = text.lstrip("\ufeff")
        reader = csv.reader(io.StringIO(text))
        rows = [r for r in reader if any(cell.strip() for cell in r)]
        if not rows:
            raise ImportError_("CSV 内容为空")
        header = [h.strip().lower() for h in rows[0]]
        col_index: dict[str, int] = {}
        for key, aliases in _HEADER_ALIASES.items():
            for alias in aliases:
                if alias.lower() in header:
                    col_index[key] = header.index(alias.lower())
                    break
        missing = [k for k in ("sku", "name", "system_qty") if k not in col_index]
        if missing:
            raise ImportError_("CSV 表头缺少必要列：货号/sku、名称/name、账面数量/system_qty")

        new_items: list[tuple[str, str, str, str, int]] = []
        for lineno, row in enumerate(rows[1:], start=2):
            def cell(key: str) -> str:
                idx = col_index.get(key)
                return row[idx].strip() if idx is not None and idx < len(row) else ""

            sku = cell("sku")
            if not sku:
                raise ImportError_(f"第 {lineno} 行缺少货号")
            qty_raw = cell("system_qty")
            try:
                qty = int(qty_raw)
            except ValueError:
                raise ImportError_(f"第 {lineno} 行账面数量不是整数：{qty_raw!r}")
            new_items.append((sku, cell("name"), cell("category"), cell("shelf"), qty))

        # 全部校验通过后才替换当前会话，避免导入失败留下半截数据
        self.reset()
        for sku, name, category, shelf, qty in new_items:
            self.add_product(sku, name, category, shelf, qty)
        return {"imported": len(new_items)}

    # ---- 实盘录入 ----
    def record_count(self, sku: str, qty: int, overwrite: bool = False) -> Product:
        """录入实盘数量。已录过的商品默认抛 DuplicateCountError，
        只有调用方显式 overwrite=True（用户确认）才覆盖。"""
        sku = sku.strip()
        if qty < 0:
            raise ValueError("实盘数量不能为负数")
        product = self.products.get(sku)
        if product is None:
            raise UnknownSkuError(sku)
        if product.counted and not overwrite:
            raise DuplicateCountError(sku, product.actual_qty, qty)
        product.actual_qty = qty
        return product

    def set_reason(self, sku: str, reason: str) -> Product:
        product = self.products.get(sku.strip())
        if product is None:
            raise UnknownSkuError(sku)
        product.reason = reason.strip()
        return product

    # ---- 查询 ----
    def list_products(self) -> list[dict]:
        return [self.products[sku].to_dict() for sku in self.order]

    def summary(self) -> dict:
        total = len(self.order)
        counted = sum(1 for sku in self.order if self.products[sku].counted)
        diffs = [self.products[sku].diff for sku in self.order if self.products[sku].diff]
        return {
            "total": total,
            "counted": counted,
            "uncounted": total - counted,
            "diff_items": len(diffs),
            "diff_qty": sum(diffs),
        }

    def diffs_by(self, field_name: str) -> list[dict]:
        """按货架或类别分组查看账实差异。"""
        if field_name not in ("shelf", "category"):
            raise ValueError("只支持按 shelf 或 category 分组")
        groups: dict[str, dict] = {}
        for sku in self.order:
            p = self.products[sku]
            key = getattr(p, field_name)
            g = groups.setdefault(key, {
                "group": key, "total": 0, "counted": 0,
                "system_qty": 0, "actual_qty": 0, "diff_qty": 0, "diff_items": 0,
                "items": [],
            })
            g["total"] += 1
            g["system_qty"] += p.system_qty
            if p.counted:
                g["counted"] += 1
                g["actual_qty"] += p.actual_qty
                g["diff_qty"] += p.diff
                if p.diff != 0:
                    g["diff_items"] += 1
            g["items"].append(p.to_dict())
        return sorted(groups.values(), key=lambda g: g["group"])

    def review_rows(self) -> list[dict]:
        """复盘表：所有有差异的商品，按差异绝对值从大到小排列。"""
        rows = [self.products[sku].to_dict() for sku in self.order
                if self.products[sku].counted and self.products[sku].diff != 0]
        rows.sort(key=lambda r: (-abs(r["diff"]), r["shelf"], r["sku"]))
        return rows

    # ---- 导出 ----
    def export_counts_csv(self) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        writer.writerow(["货号", "名称", "类别", "货架", "账面数量", "实盘数量", "差异", "差异原因"])
        for sku in self.order:
            p = self.products[sku]
            writer.writerow([p.sku, p.name, p.category, p.shelf, p.system_qty,
                             "" if p.actual_qty is None else p.actual_qty,
                             "" if p.diff is None else p.diff, p.reason])
        return buf.getvalue()

    def export_review_csv(self) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf, lineterminator="\n")
        writer.writerow(["货号", "名称", "类别", "货架", "账面数量", "实盘数量", "差异", "差异原因"])
        for row in self.review_rows():
            writer.writerow([row["sku"], row["name"], row["category"], row["shelf"],
                             row["system_qty"], row["actual_qty"], row["diff"], row["reason"]])
        return buf.getvalue()
