#!/usr/bin/env python3

import sys
import json
import subprocess

settings = json.loads(sys.stdin.read())

section = settings["section"]

for parm in settings["parms"].keys():
	try:
		child = subprocess.Popen(["net", "conf", "setparm", section, parm, settings["parms"][parm]], stdout=subprocess.PIPE)
	except OSError:
		print("Error executing net conf setparm, is it installed?", file=sys.stderr)
		sys.exit(1)
	out, err = child.communicate()
	if(child.wait() != 0):
		print(err, file=sys.stderr);
		sys.exit(child.returncode)

sys.exit(0)
