#!/bin/sh

testers=$1  # number of testers
users=$2    # number of users per tester
duration=$3 # duration in seconds
docID="testing at $(date)"
for (( i=1; i<=testers; i++ ))
do
  heroku run node stress-test-heroku.js $testers $users $docID> tester.$i.log &
done
