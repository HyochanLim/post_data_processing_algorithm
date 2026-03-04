import argparse
import json
from pathlib import Path

import pandas as pd


def excel_to_json(input_path: Path, output_path: Path, sheet_name: str | int = 0) -> None:
	dataframe = pd.read_excel(input_path, sheet_name=sheet_name)
	records = dataframe.to_dict(orient="records")

	output_path.parent.mkdir(parents=True, exist_ok=True)
	with output_path.open("w", encoding="utf-8") as file:
		json.dump(records, file, ensure_ascii=False, indent=2)


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(description="Convert Excel file to JSON records.")
	parser.add_argument("input", type=Path, help="Input Excel file path")
	parser.add_argument("output", type=Path, help="Output JSON file path")
	parser.add_argument("--sheet", default=0, help="Sheet index or name (default: 0)")
	return parser.parse_args()


def main() -> None:
	args = parse_args()
	sheet = int(args.sheet) if str(args.sheet).isdigit() else args.sheet
	excel_to_json(args.input, args.output, sheet_name=sheet)


if __name__ == "__main__":
	main()
