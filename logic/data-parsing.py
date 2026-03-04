from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
SAT_FIELD_PATTERN = re.compile(r"^sat\d+$")


def to_json_value(value: Any) -> Any:
	if pd.isna(value):
		return None
	if isinstance(value, pd.Timestamp):
		return value.isoformat()
	return value


def dataframe_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
	records: list[dict[str, Any]] = []
	for row in df.to_dict(orient="records"):
		records.append(
			{
				key: to_json_value(value)
				for key, value in row.items()
				if not SAT_FIELD_PATTERN.match(str(key))
			}
		)
	return records


def parse_excel_file(excel_path: Path) -> Path:
	sheets = pd.read_excel(excel_path, sheet_name=None)

	if len(sheets) == 1:
		only_sheet = next(iter(sheets.values()))
		payload: Any = dataframe_to_records(only_sheet)
	else:
		payload = {
			sheet_name: dataframe_to_records(df)
			for sheet_name, df in sheets.items()
		}

	output_path = excel_path.with_suffix(".json")
	with output_path.open("w", encoding="utf-8") as file:
		json.dump(payload, file, ensure_ascii=False, indent=2)

	return output_path


def main() -> None:
	excel_files = sorted(RAW_DIR.glob("*.xlsx")) + sorted(RAW_DIR.glob("*.xls"))
	if not excel_files:
		print(f"No Excel files found in: {RAW_DIR}")
		return

	for excel_file in excel_files:
		output_file = parse_excel_file(excel_file)
		print(f"Parsed: {excel_file.name} -> {output_file.name}")


if __name__ == "__main__":
	main()
