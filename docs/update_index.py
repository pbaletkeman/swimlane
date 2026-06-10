import pathlib

# Replace with your directory path
directory_path = pathlib.Path(".")

contents: str = ""

for file_path in directory_path.iterdir():
    if file_path.is_file():
        if file_path.name != "update_index.py":  # Skip the index.md file
          contents = contents + f"- [{file_path}]({file_path})\n"  # Appends the filename to contents with a newline

with open("index.md", "w", encoding="utf-8") as index_file:
    index_file.write("# Index\n\n")  # Writes a header to index.md
    index_file.write(contents)  # Writes the contents to index.md
