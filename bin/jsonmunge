#!/usr/bin/env python3

import sys
import csv
import json

writer = csv.writer(sys.stdout)

data = json.load(sys.stdin)
out = []

for row in data["data"]:
    i = 0
    item = {}
    for value in row:
        item[data["columns"][i]] = value
        i += 1
    out.append(item)

json.dump(out, sys.stdout)