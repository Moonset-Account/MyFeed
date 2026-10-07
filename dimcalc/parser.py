"""算式解析：变量、数字、括号、加减乘除与整数幂。"""
from __future__ import annotations

import re
from dataclasses import dataclass
from fractions import Fraction


class ParseError(Exception):
    pass


@dataclass
class Num:
    value: Fraction


@dataclass
class Var:
    name: str


@dataclass
class Bin:
    op: str  # + - * /
    left: object
    right: object


@dataclass
class Neg:
    operand: object


@dataclass
class Pow:
    base: object
    exponent: int


_TOKEN_RE = re.compile(r"\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(.))")


def _tokenize(text: str) -> list[tuple[str, str]]:
    tokens = []
    pos = 0
    while pos < len(text):
        m = _TOKEN_RE.match(text, pos)
        if not m or m.end() == pos:
            raise ParseError(f"无法识别的字符（位置 {pos + 1}）")
        pos = m.end()
        num, ident, other = m.groups()
        if num is not None:
            tokens.append(("num", num))
        elif ident is not None:
            tokens.append(("ident", ident))
        elif other.strip():
            if other not in "+-*/^()":
                raise ParseError(f"无法识别的符号「{other}」（位置 {pos}）")
            tokens.append(("op", other))
    return tokens


class _Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.i = 0

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else (None, None)

    def next(self):
        tok = self.peek()
        self.i += 1
        return tok

    def expect_op(self, op):
        kind, val = self.peek()
        if kind != "op" or val != op:
            raise ParseError(f"缺少「{op}」（第 {self.i + 1} 个记号处）")
        self.i += 1

    # expr := term (('+'|'-') term)*
    def expr(self):
        node = self.term()
        while True:
            kind, val = self.peek()
            if kind == "op" and val in "+-":
                self.next()
                node = Bin(val, node, self.term())
            else:
                return node

    # term := factor (('*'|'/') factor)*
    def term(self):
        node = self.factor()
        while True:
            kind, val = self.peek()
            if kind == "op" and val in "*/":
                self.next()
                node = Bin(val, node, self.factor())
            else:
                return node

    # factor := unary ('^' 整数指数)?
    def factor(self):
        node = self.unary()
        kind, val = self.peek()
        if kind == "op" and val == "^":
            self.next()
            node = Pow(node, self.exponent())
        return node

    def exponent(self) -> int:
        sign = 1
        kind, val = self.peek()
        paren = False
        if kind == "op" and val == "(":
            self.next()
            paren = True
            kind, val = self.peek()
        if kind == "op" and val == "-":
            sign = -1
            self.next()
            kind, val = self.peek()
        if kind != "num" or "." in val:
            raise ParseError("指数必须是整数（支持负整数，如 a^-2 或 a^(-2)）")
        self.next()
        n = sign * int(val)
        if paren:
            self.expect_op(")")
        return n

    # unary := '-' unary | atom
    def unary(self):
        kind, val = self.peek()
        if kind == "op" and val == "-":
            self.next()
            return Neg(self.unary())
        return self.atom()

    def atom(self):
        kind, val = self.next()
        if kind == "num":
            return Num(Fraction(val))
        if kind == "ident":
            return Var(val)
        if kind == "op" and val == "(":
            node = self.expr()
            self.expect_op(")")
            return node
        raise ParseError(f"表达式不完整或存在意外的「{val}」（第 {self.i} 个记号处）")


def parse_expression(text: str):
    text = (text or "").strip()
    if not text:
        raise ParseError("表达式为空")
    parser = _Parser(_tokenize(text))
    node = parser.expr()
    if parser.i < len(parser.tokens):
        kind, val = parser.tokens[parser.i]
        raise ParseError(f"表达式在「{val}」处无法继续解析")
    return node


def collect_vars(node) -> set:
    if isinstance(node, Var):
        return {node.name}
    if isinstance(node, Bin):
        return collect_vars(node.left) | collect_vars(node.right)
    if isinstance(node, Neg):
        return collect_vars(node.operand)
    if isinstance(node, Pow):
        return collect_vars(node.base)
    return set()


def _fmt_num(value: Fraction) -> str:
    if value.denominator == 1:
        return str(value.numerator)
    return str(float(value))


def node_str(node) -> str:
    if isinstance(node, Num):
        return _fmt_num(node.value)
    if isinstance(node, Var):
        return node.name
    if isinstance(node, Neg):
        return f"-{node_str(node.operand)}"
    if isinstance(node, Pow):
        return f"{node_str(node.base)}^{node.exponent}"
    if isinstance(node, Bin):
        return f"({node_str(node.left)} {node.op} {node_str(node.right)})"
    raise AssertionError(f"未知节点 {node!r}")
