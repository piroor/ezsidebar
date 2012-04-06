#!/bin/sh

appname=ezsidebar

cp buildscript/makexpi.sh ./
./makexpi.sh -n $appname
rm ./makexpi.sh

