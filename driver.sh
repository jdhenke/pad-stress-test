#!/bin/sh

testers=$1  # number of testers
users=$2    # number of users per tester
duration=$3 # duration in seconds

for (( i=1; i<=testers; i++ ))
do
  heroku run node stress-test-heroku.js $2 $3 > tester.$i.log &
done
