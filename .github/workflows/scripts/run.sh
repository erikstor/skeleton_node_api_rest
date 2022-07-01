#!/bin/bash
#set -x #echo on
# ssh -i /d/projects/wihom/scripts-wihom/keys/QA_Wihom.pem ubuntu@54.237.8.254 'bash -s' < ./zero-down-time-test/run.sh

# echo $(docker ps -f name=$reverse-proxy   -q | tail -n1)
#restart nginx by id
#docker exec $(docker ps -f name=$reverse-proxy   -q | tail -n1) /usr/sbin/nginx -s reload  
# restart nging by name
# docker inspect --format='{{.Name}}' $( docker ps -f name=$reverse-proxy -aq --no-trunc) | cut -c2-

 #docker exec $(docker inspect --format='{{.Name}}' $( docker ps -f name=$reverse-proxy -aq --no-trunc) | cut -c2-) /usr/sbin/nginx -s reload  

echo "Service name: $1"
echo "Api context: $2"
echo "Docker script in: $3"

service_name=$1
api_context=$2
docker_script_path=$3

nginx_container_name=nginx
[ ! -z "$4" ] && nginx_container_name=$4
echo "Nginx service name: $nginx_container_name"

cd $docker_script_path



timer(){
  echo "Waiting to rest nginx"
  i=5
  [ ! -z "$1" ] && i=$1
  for (( i; i>0; i--)); do
  echo "$i s"
  sleep 1
done
}


##
reload_nginx() {  
  echo "Reloading nginx"
  #docker exec $nginx_container_name /usr/sbin/nginx -s reload  
  #docker exec $(docker ps -f name=nginx   -q | tail -n1) /usr/sbin/nginx -s reload 
  docker exec $(docker ps -f name=$nginx_container_name   -q | tail -n1) nginx -s reload 
}

# server health check
server_status() {
  # $1 = first func arg
  local port=$1
  local status=$(curl -is --connect-timeout 5 --show-error http://localhost:$port/$api_context | head -n 1 | cut -d " " -f2)

  # if status is not a status code (123), means we got an error not an http header
  # this could be a timeout message, connection refused error msg, and so on...
  if [[ $(echo ${#status}) != 3 ]]; then
    echo "503"
  fi

  echo $status
}

update_server() {

  old_container_id=$(docker ps -f name=$service_name -q | tail -n1)

  # create a new instance of the server
  docker-compose up --build -d --no-deps --scale $service_name=2 --no-recreate $service_name
  new_container_id=$(docker ps -f name=$service_name -q | head -n1)

  if [[ -z $new_container_id ]]; then
    echo "ID NOT FOUND, QUIT !"
    exit
  fi
  new_container_port=$(docker port $new_container_id | cut -d " " -f3 | cut -d ":" -f2)

  if [[ -z $new_container_port ]]; then
    echo "PORT NOT FOUND, QUIT !"
    exit
  fi

  # sleep until server is up
  while [[ $(server_status $new_container_port) > "404" ]]; do
    echo "New instance is getting ready..."
    #sleep 5
    timer 10
  done

  # ---- server is up ---

  # reload nginx, so it can recognize the new instance
  reload_nginx

  # remove old instance 
  echo  "removing old container with id: $old_container_id"
  docker rm $old_container_id -f

  # reload ngnix, so it stops routing requests to the old instance
  reload_nginx

  echo "Server is updated !"
}

#call timer 
#timer

# call func
update_server
