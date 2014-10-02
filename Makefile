#USERNAME = `whoami`
USERNAME = rcs
REMOTE = $(USERNAME)@login.eecs.berkeley.edu:/home/eecs/rcs/public_html/research/web_simulator/

push:
	scp -r * $(REMOTE)
