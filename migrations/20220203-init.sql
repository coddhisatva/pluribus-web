create database pluribus;
use pluribus;

\! echo 'Creating MySQL user account for web...'
create user 'pluribus-web'@'localhost' identified with mysql_native_password by 'pluribus-web';
grant all privileges on pluribus.* to 'pluribus-web'@'localhost';
flush privileges;

\! echo 'Creating users table...';
create table users (
	id int not null auto_increment,
	email nvarchar(100) not null,
	password nvarchar(200) not null,
	created datetime not null,
	updated datetime not null,
	constraint pk_users primary key(id)
);

\! echo 'Creating creators table...';
create table creators (
	id int not null auto_increment,
	user_id int not null,
	name varchar(50) not null,
	about text not null,
	created datetime not null,
	updated datetime not null,
	constraint pk_creators primary key(id),
	constraint fk_creators_users foreign key (user_id) references users(id)
);

\! echo 'Inserting dummy data...'
insert users(email, password, created, updated) values ('joerogan@jre.com', 'joerogan', now(), now());
insert creators(user_id, name, about, created, updated) values (last_insert_id(), 'Joe Rogan', 'The Joe Rogan Experience podcast', now(), now());

insert users(email, password, created, updated) values ('harrybergeron@substack.com', 'harrybergeron', now(), now());
insert creators(user_id, name, about, created, updated) values (last_insert_id(), 'Harry Bergeron', 'Writing American Alchemy at harrybergeron.substack.com', now(), now());

-- Demo user-only login
insert users(email, password, created, updated) values ('test@pluribus.com', 'test', now(), now());


\! echo 'Migrated.';