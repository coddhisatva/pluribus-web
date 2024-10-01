docker-compose down -t 0
docker-compose up -d --wait
npx sequelize db:migrate    
npx sequelize-cli db:seed:all
echo "Test Card: 4242 4242 4242 4242"