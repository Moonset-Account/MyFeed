"""单位表与单位表达式解析（如 kg*m/s^2、J/(kg*K)、m^(1/2)）。

温度单位区分绝对温度（K、°C）与温差（ΔK、Δ°C）：
- 单独写 K / °C 表示绝对温度，禁止参与乘除与乘方（摄氏带偏移，不能套乘法换算）；
- ΔK / Δ°C 表示温差，可正常参与乘除；
- 温度单位出现在复合单位中（如 J/(kg*K)）时按温差处理，符合物理惯例。
"""
from __future__ import annotations

import re
from fractions import Fraction

from .dimension import Dimension, Quantity, dim, KIND_ABS, KIND_DELTA


class UnitError(Exception):
    pass


def _q(dims: Dimension, kind: str | None = None) -> Quantity:
    return Quantity(dims, kind)


UNIT_TABLE: dict[str, Quantity] = {
    # 基本单位
    "m": _q(dim(L=1)),
    "kg": _q(dim(M=1)),
    "g": _q(dim(M=1)),
    "s": _q(dim(T=1)),
    "min": _q(dim(T=1)),
    "h": _q(dim(T=1)),
    # 绝对温度
    "K": _q(dim(TH=1), KIND_ABS),
    "°C": _q(dim(TH=1), KIND_ABS),
    "degC": _q(dim(TH=1), KIND_ABS),
    # 温差
    "ΔK": _q(dim(TH=1), KIND_DELTA),
    "Δ°C": _q(dim(TH=1), KIND_DELTA),
    "ΔdegC": _q(dim(TH=1), KIND_DELTA),
    "dK": _q(dim(TH=1), KIND_DELTA),
    "dC": _q(dim(TH=1), KIND_DELTA),
    # 导出单位
    "N": _q(dim(M=1, L=1, T=-2)),
    "J": _q(dim(M=1, L=2, T=-2)),
    "W": _q(dim(M=1, L=2, T=-3)),
    "Pa": _q(dim(M=1, L=-1, T=-2)),
}

_SYMBOL_RE = re.compile(r"[A-Za-z°Δ]+")
_EXP_RE = re.compile(r"-?\d+(?:/\d+)?")


def _parse_exponent(text: str, pos: int) -> tuple[Fraction, int]:
    m = _EXP_RE.match(text, pos)
    if not m:
        raise UnitError(f"单位指数非法：「{text[pos:]}」，应为整数或分数（如 s^-2、m^(1/2)）")
    return Fraction(m.group()), m.end()


def parse_unit(text: str) -> Quantity:
    """解析单位表达式，如 kg*m/s^2、J/(kg*K)、°C、Δ°C、1。"""
    text = (text or "").strip()
    if not text:
        raise UnitError("单位为空")
    if text == "1":
        return _q(Dimension.dimensionless())

    dims = Dimension.dimensionless()
    pos = 0
    op = "*"
    n = len(text)
    factor_count = 0
    single_temp_kind = None  # 整个表达式恰好是单个温度单位时保留其类别
    while pos < n:
        ch = text[pos]
        if ch in "*/":
            op = ch
            pos += 1
            continue
        if ch.isspace():
            pos += 1
            continue
        m = _SYMBOL_RE.match(text, pos)
        if not m:
            raise UnitError(f"无法解析单位「{text}」（位置 {pos + 1}）")
        sym = m.group()
        pos = m.end()
        exp = Fraction(1)
        if pos < n and text[pos] == "^":
            pos += 1
            if pos < n and text[pos] == "(":
                exp, pos = _parse_exponent(text, pos + 1)
                if pos >= n or text[pos] != ")":
                    raise UnitError(f"单位指数缺少右括号：「{text}」")
                pos += 1
            else:
                exp, pos = _parse_exponent(text, pos)
        if sym not in UNIT_TABLE:
            raise UnitError(
                f"未知单位「{sym}」，可用：{', '.join(UNIT_TABLE)} 及 1（无量纲）"
            )
        unit = UNIT_TABLE[sym]
        if unit.kind is not None and exp != 1:
            raise UnitError(f"温度单位「{sym}」不能带指数（绝对温度与温差都不能乘方）")
        signed = exp if op == "*" else -exp
        dims = dims + unit.dims.scale(signed)
        factor_count += 1
        if unit.kind is not None:
            # 复合单位中的温度一律按温差处理；单独出现时才保留绝对/温差类别
            single_temp_kind = unit.kind if factor_count == 1 and op == "*" else KIND_DELTA
        op = "*"
    kind = single_temp_kind if dims.is_pure_temperature else None
    return Quantity(dims, kind)
