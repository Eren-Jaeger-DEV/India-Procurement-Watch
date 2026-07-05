import os
import re

with open("app.py", "r", encoding="utf-8") as f:
    content = f.read()

# I will just write the blueprints manually via replace_file_content instead of trying to write a complex AST parser here.
