// deleteqsos - a utility to delete qso files less than MINSIZE bytes in size
// and to delete folders that have no qso files in them.
//

var fs = require('fs');
const homedir = require('os').homedir();
const config = require('./config');
const util = require('util');

const MINSIZE = 200; // can change this if 200 is too small or too large

function sleep(millis) 
{
	return new Promise(resolve => setTimeout(resolve, millis));  
}

function getFiles(dir)
{
  files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)
    
  return files;
}    

function getDirectories(dir)
{
  dirs = fs.readdirSync(dir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    
  return dirs;
}    

function getFileSize(filePath)
{
    let stats = fs.statSync(filePath);
    let fileSizeInBytes = stats.size;
    
    return fileSizeInBytes;
}

function deleteFolderRecursive(path) 
{
  if( fs.existsSync(path) ) 
  {
    fs.readdirSync(path).forEach(function(file,index)
    {
      var curPath = path + "/" + file;
      
      if(fs.lstatSync(curPath).isDirectory()) 
      { // recurse
        deleteFolderRecursive(curPath);
      } 
      else 
      { // delete file
        fs.unlinkSync(curPath);
      }
    });
    
    fs.rmdirSync(path);
  }
};

function deleteqsos() 
{
    let qsodatadir = config.qsodatadir;

    if(qsodatadir == "") // if no directory in config.js then use the default one
      qsodatadir = homedir + '/.js8assistant/qsodata/'; // this is the default data directory
    
    console.log("QSO Data Folder: " + qsodatadir);
        
    let dirs = getDirectories(qsodatadir);
    
    dirs.forEach(dir => 
    {
      let dirPath = qsodatadir + dir;
      //console.log(dirPath);
      
      let files = getFiles(dirPath)

      files.forEach(file =>
      {
        let filePath = dirPath + '/' + file;
        //console.log(filePath);
        let fileSize = getFileSize(filePath);
        //console.log(fileSize);
        
        if(fileSize < MINSIZE)
        {
          console.log("Delete this file: " + filePath);
          fs.unlinkSync(filePath);
        }
      });    
    });

    // Now delete the empty folders
    dirs.forEach(dir => 
    {
      let dirPath = qsodatadir + dir;
      //console.log(dirPath);
      
      let files = getFiles(dirPath)
      
      if(files.length == 0)
      {
        console.log("Delete this folder: " + dirPath);
        //fs.rmdirSync(dirPath);
        deleteFolderRecursive(dirPath); // sometimes the folder can have sub folders due to a bug in saving
      }
    });
}

let logPath = process.argv[2];

let ourLog = logPath.replace("main.log", "deleteqsos.log");

let log_file = fs.createWriteStream(ourLog, {flags : 'w'});
let log_stdout = process.stdout;

console.log = function(d) 
{ 
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

deleteqsos();
