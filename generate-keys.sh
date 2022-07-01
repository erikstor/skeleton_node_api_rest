cd keys
ssh-keygen -t rsa -b 2048 -m PEM -f jwtRS256.key
openssl rsa -in jwtRS256.key -pubout -outform PEM -out jwtRS256.key.pub
ssh-keygen -t rsa -b 2048 -m PEM -f app-key.key
openssl rsa -in  app-key.key -pubout -outform PEM -out app-key.key.pub
