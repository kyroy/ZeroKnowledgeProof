# ZeroKnowledgeProof
Master Thesis

## Run with Docker provivus/testrpc
```
sudo docker run provivus/testrpc
sudo docker ps
sudo docker inspect --format '{{ .NetworkSettings.IPAddress }}' 99fe02fc0241
WEB3_PROVIDER=http://172.17.0.2:8545 npm run test
```
