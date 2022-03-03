# MySQL on MacOS

MySQL is case insensitive on MacOS but case sensitive in production (Linux).

In order to make MySQL case sensitive in development (and catch bugs before sending them to the repo), follow these steps.

1. Start with no MySQL installed. If you happen to have already installed MySQL with Homebrew, run `brew uninstall mysql`. If you installed with the DMG installer, you can uninstall from the MySQL pane in System Preferences.
2. Install MySQL with `brew install mysql`.
3. Open Disk Utility and choose File > New Image > Blank image...
4. Name the new image "MySQL", choose "APFS (Case-sensitive)" as the format, and make it at least 300 MB.
5. Mount the new image.
6. Run `mkdir /Volumes/MySQL/data`.
7. Run `/usr/local/opt/mysql/bin/mysqld --initialize --datadir=/Volumes/MySQL/data --lower_case_table_names=0`.
8. Edit `/usr/local/Cellar/mysql/[version]/homebrew.mxcl.mysql.plist` and set `--datadir=/Volumes/MySQL/data`.
9. Run `brew services start mysql`.
10. Open System Preferences and go to the Users and Groups pane. Add /Documents/MySQL.dmg under 'Login Items' so that the case sensitive volume is automatically mounted on login.
