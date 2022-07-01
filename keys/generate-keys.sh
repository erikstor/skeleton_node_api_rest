cd keys
ssh-keygen -t rsa -b 2048 -m PEM -f integroApp-jwtRS256.key
openssl rsa -in integroApp-jwtRS256.key -pubout -outform PEM -out integroApp-jwtRS256.key.pub
