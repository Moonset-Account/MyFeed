"""维度与物理量的数据模型。

维度用 4 个基本量（长度 L、质量 M、时间 T、温度 Θ）的有理数指数表示，
指数一律使用 fractions.Fraction 存储，支持如 m^(1/2) 之类的分数次幂。
温度量额外携带 kind 标记，区分绝对温度（abs）与温差（delta）。
"""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

BASES = ("L", "M", "T", "Θ")
BASE_NAMES = {"L": "长度", "M": "质量", "T": "时间", "Θ": "温度"}
BASE_UNIT_SYMBOL = {"L": "m", "M": "kg", "T": "s", "Θ": "K"}
DISPLAY_ORDER = ("M", "L", "T", "Θ")

KIND_ABS = "abs"      # 绝对温度（K、°C）
KIND_DELTA = "delta"  # 温差（ΔK、Δ°C）


def dim(L=0, M=0, T=0, TH=0) -> "Dimension":
    return Dimension((Fraction(L), Fraction(M), Fraction(T), Fraction(TH)))


def _fmt_exp(e: Fraction) -> str:
    return str(e.numerator) if e.denominator == 1 else f"{e.numerator}/{e.denominator}"


def _factor(sym: str, e: Fraction) -> str:
    return sym if e == 1 else f"{sym}^{_fmt_exp(e)}"


@dataclass(frozen=True)
class Dimension:
    """四个基本量指数组成的有理数向量。"""

    exps: tuple  # (L, M, T, Θ) 的 Fraction 四元组

    @staticmethod
    def dimensionless() -> "Dimension":
        return dim()

    def __add__(self, other: "Dimension") -> "Dimension":
        return Dimension(tuple(a + b for a, b in zip(self.exps, other.exps)))

    def __sub__(self, other: "Dimension") -> "Dimension":
        return Dimension(tuple(a - b for a, b in zip(self.exps, other.exps)))

    def scale(self, n) -> "Dimension":
        n = Fraction(n)
        return Dimension(tuple(a * n for a in self.exps))

    @property
    def is_dimensionless(self) -> bool:
        return all(e == 0 for e in self.exps)

    @property
    def is_pure_temperature(self) -> bool:
        return self.exps == dim(TH=1).exps

    def get(self, base: str) -> Fraction:
        return self.exps[BASES.index(base)]

    def format(self, symbols: dict | None = None) -> str:
        """格式化为单位串，如 kg·m^2/s^2；无量纲返回 1。"""
        symbols = symbols or BASE_UNIT_SYMBOL
        if self.is_dimensionless:
            return "1"
        num, den = [], []
        for b in DISPLAY_ORDER:
            e = self.get(b)
            if e > 0:
                num.append(_factor(symbols[b], e))
            elif e < 0:
                den.append(_factor(symbols[b], -e))
        out = "·".join(num) if num else "1"
        if den:
            out += "/" + "·".join(den)
        return out

    def format_dimension(self) -> str:
        """用基本量符号格式化，如 M·L/T^2。"""
        return self.format({b: b for b in BASES})


@dataclass
class Quantity:
    """一个物理量：维度 + 温度类别 + 未知量来源。

    dims 为 None 表示维度未知；origin 记录该量的维度恰好等于哪个未知变量
    （仅经数乘/数除/取负传播的未知量保留 origin，用于反推约束）。
    """

    dims: Dimension | None
    kind: str | None = None
    origin: str | None = None

    @property
    def is_unknown(self) -> bool:
        return self.dims is None

    @property
    def is_abs_temp(self) -> bool:
        return (
            self.dims is not None
            and self.dims.is_pure_temperature
            and self.kind == KIND_ABS
        )

    @property
    def is_delta_temp(self) -> bool:
        return (
            self.dims is not None
            and self.dims.is_pure_temperature
            and self.kind == KIND_DELTA
        )


def fmt_qty(q: Quantity) -> str:
    if q.dims is None:
        return f"D({q.origin})" if q.origin else "D(?)"
    if q.dims.is_pure_temperature:
        if q.kind == KIND_ABS:
            return "K（绝对温度）"
        if q.kind == KIND_DELTA:
            return "ΔK（温差）"
    return q.dims.format()
