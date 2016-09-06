#!/usr/bin/python3

# Script to bruteforce y with publically know information
# for the Feige Fiat Shamir protocol

# Spreadsheet https://docs.google.com/spreadsheets/d/1wtzhlLl6K9RNLHLhRvxMCz6xicukL-YI5hFOmL4U1Mo

from math import sqrt
import argparse
parser = argparse.ArgumentParser(description = 'Bruteforce y for Feige Fiat Shamir.')

#-n RING -e EXPECTED
parser.add_argument("-n", "--n", default = 84436625, help="public n for modulo ring", type=int)
parser.add_argument("-e", "--expected", default = 39778375, help="expected value (x*v_i^e_i)", type=int)

args = parser.parse_args()

n = args.n
expected = args.expected

print ("n = %d, expected = %d" % (n, expected))
print ("Calculating y ...\n")

res = sqrt(expected)
counter = 0

while int(res) != res and counter < 100000:
	counter += 1
	res = sqrt(expected + n * counter)

if int(res) == res:
	print("Found y after %d tries!" % counter)
	print("y = %d" % res)
else:
	print("y not found after %d tries" % counter)
