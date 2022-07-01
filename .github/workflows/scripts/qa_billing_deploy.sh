 
 
user=$1
address=$2
script="$3/run.sh"
service_name=billing
api_context=billing-api
docker_script_path="~/Containers_for_API"
nginx_service_name=""

echo "desplegando billing-api en qa..."

#bajar cambios
ssh  $user@$address \
	"cd ~/projects/billing-api && git checkout qa && git pull origin qa"

#desplegar contenedor
ssh  $user@$address 'bash -s' < \
  $script $service_name $api_context $docker_script_path $nginx_service_name


# ssh -i ~/projects/wihom/scripts-wihom/keys/QA_Wihom.pem ubuntu@54.237.8.254
