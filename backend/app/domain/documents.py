import re
import secrets


def digits(value: str) -> str:
    return re.sub(r"\D", "", value)


def checksum(base: str, weights: list[int]) -> str:
    remainder = sum(int(n) * w for n, w in zip(base, weights, strict=True)) % 11
    return str(0 if remainder < 2 else 11 - remainder)


def complete_document(base: str) -> str:
    if len(base) == 9:
        first = checksum(base, list(range(10, 1, -1)))
        return base + first + checksum(base + first, list(range(11, 1, -1)))
    first = checksum(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    return base + first + checksum(base + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])


def valid_document(value: str) -> bool:
    if not re.fullmatch(r"[0-9. /-]+", value):
        return False
    value = digits(value)
    return len(value) in (11, 14) and len(set(value)) > 1 and complete_document(value[:-2]) == value


def fake_document(company: bool = True) -> str:
    return complete_document(
        "".join(str(secrets.randbelow(10)) for _ in range(8 if company else 9)) + ("0001" if company else "")
    )
