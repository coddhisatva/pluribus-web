create database pluribus;
use pluribus;

\! echo 'Creating MySQL user account for web...'
create user 'pluribus-web'@'localhost' identified with mysql_native_password by 'pluribus-web';
grant all privileges on pluribus.* to 'pluribus-web'@'localhost';
flush privileges;