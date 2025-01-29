const bcrypt = require('bcrypt'); bcrypt.hash('test123', 10).then(hash => console.log(hash));
