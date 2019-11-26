#!/usr/bin/env bash

docker run $@ -p 18443:18443 -p 18444:18444 --rm ruimarinho/bitcoin-core  \
  -regtest=1 \
  -printtoconsole \
  -rpcallowip=0.0.0.0/0 \
  -rpcbind=0.0.0.0:18443 \
  -rpcauth='test:17d76338dc3ad9a60fe49dd951e4ace6$6a3d9c9b577cef280c27b2e1fd864242034bc06f77fa958721a85d6612eb72de' \
  -rest \
  -txindex \
  -wallet=1 \
  -wallet=2
