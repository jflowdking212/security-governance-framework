function ownerAllowed(stat,currentUid) {
  return currentUid===undefined||stat.uid===0||stat.uid===currentUid;
}

export function isTrustedExecutableStat(stat,currentUid) {
  return Boolean(stat&&stat.isFile()&&(stat.mode&0o111)!==0&&(stat.mode&0o022)===0&&ownerAllowed(stat,currentUid));
}

export function isTrustedDirectoryStat(stat,currentUid) {
  return Boolean(stat&&stat.isDirectory()&&(stat.mode&0o022)===0&&ownerAllowed(stat,currentUid));
}
