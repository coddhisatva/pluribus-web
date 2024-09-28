docker-compose down -t 0
docker-compose up -d --wait
npx sequelize db:migrate    
npx sequelize-cli db:seed:all