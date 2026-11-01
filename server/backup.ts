import {backup} from 'node:sqlite';
import {openDatabase} from './database.ts';
const destination=process.argv[2];
if(!destination)throw Error('Usage: node server/backup.ts /secure/path/backup.sqlite');
const db=openDatabase();
try {await backup(db.sql,destination);console.log('SQLite backup completed.');}finally{db.close();}
