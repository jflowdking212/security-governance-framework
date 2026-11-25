import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isTrustedExecutableStat,isTrustedDirectoryStat} from '../tools/trusted-git-policy.mjs';

const TOOL=fileURLToPath(new URL('../tools/checksums.mjs',import.meta.url));

function git(cwd,...args) {
  const r=spawnSync('git',args,{cwd,encoding:'utf8'});
  assert.equal(r.status,0,'git '+args.join(' ')+' failed: '+r.stderr);
}
function fixture() {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-checksums-'));
  git(cwd,'init','-q');
  git(cwd,'config','user.name','USS Test');
  git(cwd,'config','user.email','uss-test@example.invalid');
  git(cwd,'config','commit.gpgsign','false');
  fs.writeFileSync(path.join(cwd,'README.md'),'trusted test content\n');
  fs.writeFileSync(path.join(cwd,'KERNEL.md'),'kernel test content\n');
  git(cwd,'add','README.md','KERNEL.md');
  git(cwd,'commit','-m','fixture');
  return cwd;
}
function run(cwd,command,...args) {
  return spawnSync(process.execPath,[TOOL,command,...args],{cwd,encoding:'utf8'});
}
function runWithEnv(cwd,command,env,...args) {
  return spawnSync(process.execPath,[TOOL,command,...args],{cwd,encoding:'utf8',env:{...process.env,...env}});
}
function runWithPreload(cwd,hook,command,env,...args) {
  return spawnSync(process.execPath,['--require',hook,TOOL,command,...args],{cwd,encoding:'utf8',env:{...process.env,...env}});
}

test('checksum tool creates a deterministic manifest and verifies it',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const first=run(cwd,'create');
  assert.equal(first.status,0,first.stderr);
  const manifest=fs.readFileSync(path.join(cwd,'SHA256SUMS'),'utf8');
  assert.match(manifest,/^[a-f0-9]{64}  KERNEL\.md\n[a-f0-9]{64}  README\.md\n$/);
  git(cwd,'add','SHA256SUMS');
  git(cwd,'commit','-m','add checksum manifest');
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
});

test('verification rejects content modified after the manifest was created',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add checksum manifest');
  fs.writeFileSync(path.join(cwd,'README.md'),'tampered content\n');
  git(cwd,'add','README.md');git(cwd,'commit','-m','tamper tracked content');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/SHA-256 mismatch: README\.md/);
});

test('verification rejects files added after the manifest was created',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add checksum manifest');
  fs.writeFileSync(path.join(cwd,'NEW-POLICY.md'),'unlisted policy\n');
  git(cwd,'add','NEW-POLICY.md');git(cwd,'commit','-m','add unlisted file');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Checksum file set does not match release files/);
});

test('manifest creation refuses unstaged untracked files',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.writeFileSync(path.join(cwd,'untracked.txt'),'not staged\n');
  const result=run(cwd,'create');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Untracked or ignored files/);
});

test('verification works on an extracted release snapshot without Git metadata',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  const bundle=fs.mkdtempSync(path.join(os.tmpdir(),'uss-bundle-'));
  t.after(()=>fs.rmSync(bundle,{recursive:true,force:true}));
  for(const file of ['README.md','KERNEL.md','SHA256SUMS']) {
    fs.copyFileSync(path.join(cwd,file),path.join(bundle,file));
  }
  const verified=run(bundle,'verify');
  assert.equal(verified.status,0,verified.stderr);
});

test('root option verifies a vendored USS subtree inside another Git repository',t=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-vendor-'));t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  git(cwd,'init','-q');
  git(cwd,'config','user.name','USS Test');
  git(cwd,'config','user.email','uss-test@example.invalid');
  git(cwd,'config','commit.gpgsign','false');
  fs.mkdirSync(path.join(cwd,'vendor','uss'),{recursive:true});
  fs.writeFileSync(path.join(cwd,'README.md'),'consumer project\n');
  fs.writeFileSync(path.join(cwd,'vendor','uss','KERNEL.md'),'vendored policy\n');
  git(cwd,'add','README.md','vendor/uss/KERNEL.md');
  git(cwd,'commit','-m','vendor fixture');
  const created=run(cwd,'create','--root','vendor/uss');
  assert.equal(created.status,0,created.stderr);
  git(cwd,'add','vendor/uss/SHA256SUMS');
  git(cwd,'commit','-m','add vendored checksum manifest');
  const verified=run(cwd,'verify','--root','vendor/uss');
  assert.equal(verified.status,0,verified.stderr);
});

test('filesystem mode creates and verifies a separate manifest for generated release bundles',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const bundle=path.join(cwd,'dist','bundles');
  fs.mkdirSync(bundle,{recursive:true});
  fs.writeFileSync(path.join(bundle,'payments.md'),'compiled payments bundle\n');
  fs.writeFileSync(path.join(bundle,'full-audit.md'),'compiled audit bundle\n');
  const created=run(cwd,'create','--root','dist/bundles','--filesystem');
  assert.equal(created.status,0,created.stderr);
  const manifest=fs.readFileSync(path.join(bundle,'SHA256SUMS'),'utf8');
  assert.match(manifest,/payments\.md/);
  assert.match(manifest,/full-audit\.md/);
  const verified=run(cwd,'verify','--root','dist/bundles','--filesystem');
  assert.equal(verified.status,0,verified.stderr);
  fs.writeFileSync(path.join(bundle,'payments.md'),'tampered bundle\n');
  const rejected=run(cwd,'verify','--root','dist/bundles','--filesystem');
  assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/SHA-256 mismatch: payments\.md/);
});

test('adversarial: filesystem checksum mode rejects a symlinked root and symlinked root ancestors',t=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-symlink-cwd-'));
  const external=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-symlink-external-'));
  t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  t.after(()=>fs.rmSync(external,{recursive:true,force:true}));
  fs.mkdirSync(path.join(external,'subdir'),{recursive:true});
  fs.writeFileSync(path.join(external,'README.md'),'external snapshot root\n');
  fs.writeFileSync(path.join(external,'subdir','README.md'),'external nested snapshot root\n');

  const linkType=process.platform==='win32'?'junction':'dir';
  try {
    fs.symlinkSync(external,path.join(cwd,'root-link'),linkType);
    fs.symlinkSync(external,path.join(cwd,'parent-link'),linkType);
  } catch(error) {
    if(error.code==='EPERM'||error.code==='EACCES') {
      t.skip('Platform does not permit creating directory symlinks or junctions');
      return;
    }
    throw error;
  }

  const direct=run(cwd,'create','--root','root-link','--filesystem');
  assert.notEqual(direct.status,0,'Filesystem mode must reject a symlink used as the selected root');
  assert.match(direct.stderr,/Checksum root path traverses a symbolic link/);

  const ancestor=run(cwd,'create','--root','parent-link/subdir','--filesystem');
  assert.notEqual(ancestor.status,0,'Filesystem mode must reject a symlink in a parent component of the selected root');
  assert.match(ancestor.stderr,/Checksum root path traverses a symbolic link/);
});

test('Git-mode verification is stable across Windows CRLF worktree conversion',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  git(cwd,'config','core.autocrlf','true');
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add checksum manifest');
  const readme=fs.readFileSync(path.join(cwd,'README.md'),'utf8').replace(/\r?\n/g,'\r\n');
  fs.writeFileSync(path.join(cwd,'README.md'),readme);
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
});

test('manifest creation rejects ignored untracked files outside dist bundles',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.writeFileSync(path.join(cwd,'.gitignore'),'secret-local.txt\n');
  git(cwd,'add','.gitignore');
  git(cwd,'commit','-m','ignore local secret file');
  fs.writeFileSync(path.join(cwd,'secret-local.txt'),'untrusted ignored file\n');
  const result=run(cwd,'create');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Untracked or ignored files/);
});

test('adversarial: rejects assume-unchanged index bypass concealing modifications',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add manifest');
  fs.writeFileSync(path.join(cwd,'README.md'),'malicious payload\n');
  git(cwd,'update-index','--assume-unchanged','README.md');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0,'Verification must fail when assume-unchanged flag is used');
  assert.match(result.stderr,/Non-default Git index flags|Working-tree bytes differ|SHA-256 mismatch/);
});

test('adversarial: rejects skip-worktree index bypass concealing modifications',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add manifest');
  fs.writeFileSync(path.join(cwd,'README.md'),'malicious payload\n');
  git(cwd,'update-index','--skip-worktree','README.md');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0,'Verification must fail when skip-worktree flag is used');
  assert.match(result.stderr,/Non-default Git index flags|Working-tree bytes differ|SHA-256 mismatch/);
});

test('adversarial: rejects uncommitted working tree modifications in Git mode',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add manifest');
  fs.writeFileSync(path.join(cwd,'KERNEL.md'),'tampered working tree content\n');
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0,'Verification must fail when working tree is dirty');
  assert.match(result.stderr,/Repository has changes outside|Working-tree bytes differ|SHA-256 mismatch/);
});

test('adversarial: rejects nested .git directories in filesystem mode',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-nested-git-fs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'main doc\n');
  fs.mkdirSync(path.join(dir,'sub','.git'),{recursive:true});
  fs.writeFileSync(path.join(dir,'sub','.git','config'),'sub git config\n');
  const created=run(dir,'create','--filesystem');
  assert.notEqual(created.status,0,'Creation must fail when nested .git directory exists in filesystem mode');
  assert.match(created.stderr,/Unexpected nested \.git directory/);
});

test('adversarial: rejects nested .git directories in Git mode',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.mkdirSync(path.join(cwd,'sub','.git'),{recursive:true});
  fs.writeFileSync(path.join(cwd,'sub','.git','config'),'sub git config\n');
  const created=run(cwd,'create');
  assert.notEqual(created.status,0,'Creation must fail when nested .git directory exists in Git mode');
  assert.match(created.stderr,/Unexpected nested \.git directory/);
});

test('adversarial: rejects all root .git directory metadata in filesystem mode',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-git-dir-fs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'main doc\n');

  const initial=run(dir,'create','--filesystem');
  assert.equal(initial.status,0,initial.stderr);
  fs.mkdirSync(path.join(dir,'.git','hooks'),{recursive:true});
  fs.writeFileSync(path.join(dir,'.git','config'),'[core]\n  fsmonitor = ./malicious-monitor\n');
  fs.writeFileSync(path.join(dir,'.git','hooks','pre-commit'),'#!/bin/sh\nexit 1\n');
  const verified=run(dir,'verify','--filesystem');
  assert.notEqual(verified.status,0,'Verification must fail when root .git/config is introduced after manifest creation');
  assert.match(verified.stderr,/Root \.git metadata is not allowed in filesystem mode/);

  fs.rmSync(path.join(dir,'.git'),{recursive:true,force:true});
  fs.mkdirSync(path.join(dir,'.git'),{recursive:true});
  fs.writeFileSync(path.join(dir,'.git','config'),'[core]\n  fsmonitor = ./malicious-monitor\n');
  const created=run(dir,'create','--filesystem');
  assert.notEqual(created.status,0,'Creation must fail when root .git directory metadata exists');
  assert.match(created.stderr,/Root \.git metadata is not allowed in filesystem mode/);
});

test('adversarial: rejects root .git gitfiles in filesystem mode',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-git-file-fs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'main doc\n');

  const initial=run(dir,'create','--filesystem');
  assert.equal(initial.status,0,initial.stderr);
  fs.writeFileSync(path.join(dir,'.git'),'gitdir: ../attacker-controlled-gitdir\n');
  const verified=run(dir,'verify','--filesystem');
  assert.notEqual(verified.status,0,'Verification must fail when a root .git gitfile is introduced after manifest creation');
  assert.match(verified.stderr,/Root \.git metadata is not allowed in filesystem mode/);

  fs.rmSync(path.join(dir,'.git'),{force:true});
  fs.writeFileSync(path.join(dir,'.git'),'gitdir: ../attacker-controlled-gitdir\n');
  const created=run(dir,'create','--filesystem');
  assert.notEqual(created.status,0,'Creation must fail when a root .git gitfile exists');
  assert.match(created.stderr,/Root \.git metadata is not allowed in filesystem mode/);
});

test('adversarial: does not silently exclude top-level dist directory in filesystem mode',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-dist-fs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'main doc\n');
  fs.mkdirSync(path.join(dir,'dist'),{recursive:true});
  fs.writeFileSync(path.join(dir,'dist','custom-artifact.txt'),'important dist file\n');
  const created=run(dir,'create','--filesystem');
  assert.equal(created.status,0,created.stderr);
  const manifest=fs.readFileSync(path.join(dir,'SHA256SUMS'),'utf8');
  assert.match(manifest,/dist\/custom-artifact\.txt/,'Manifest must include top-level dist files in filesystem mode');
  assert.equal(run(dir,'verify','--filesystem').status,0);
  fs.writeFileSync(path.join(dir,'dist','custom-artifact.txt'),'tampered artifact\n');
  const tampered=run(dir,'verify','--filesystem');
  assert.notEqual(tampered.status,0);
  assert.match(tampered.stderr,/SHA-256 mismatch: dist\/custom-artifact\.txt/);
});

test('adversarial: rejects unexpected untracked files in dist outside bundles',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.mkdirSync(path.join(cwd,'dist'),{recursive:true});
  fs.writeFileSync(path.join(cwd,'dist','backdoor.txt'),'unexpected dist file\n');
  const result=run(cwd,'create');
  assert.notEqual(result.status,0,'Manifest creation must reject unexpected files in dist');
  assert.match(result.stderr,/Untracked or ignored files/);
});


test('adversarial: Git-mode checksum operations do not execute repository-configured fsmonitor commands',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const hookDir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-fsmonitor-hook-'));
  t.after(()=>fs.rmSync(hookDir,{recursive:true,force:true}));
  const marker=path.join(hookDir,'executed.txt');
  const hook=path.join(hookDir,'fsmonitor.cjs');
  fs.writeFileSync(hook,[
    "const fs=require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(marker)},'executed');`,
    "process.stdout.write('0'+String.fromCharCode(10));"
  ].join(String.fromCharCode(10)));
  const command='"'+process.execPath+'" "'+hook+'"';
  git(cwd,'config','core.fsmonitor',command);

  const created=run(cwd,'create');
  assert.equal(created.status,0,created.stderr);
  assert.equal(fs.existsSync(marker),false,'Checksum creation must not execute repository core.fsmonitor');
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(fs.existsSync(marker),false,'Checksum verification must not execute repository core.fsmonitor');
});

test('adversarial: Git-mode checksum operations do not execute repository-configured clean filters',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  fs.writeFileSync(path.join(cwd,'.gitattributes'),'*.uss-filtered filter=uss-audit'+String.fromCharCode(10));
  fs.writeFileSync(path.join(cwd,'policy.uss-filtered'),'trusted policy bytes'+String.fromCharCode(10));
  git(cwd,'add','.gitattributes','policy.uss-filtered');
  git(cwd,'commit','-m','add filtered policy fixture');

  const hookDir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-clean-filter-'));
  t.after(()=>fs.rmSync(hookDir,{recursive:true,force:true}));
  const marker=path.join(hookDir,'executed.txt');
  const hook=path.join(hookDir,'clean-filter.cjs');
  fs.writeFileSync(hook,[
    "const fs=require('node:fs');",
    `fs.writeFileSync(${JSON.stringify(marker)},'executed');`,
    "process.stdin.pipe(process.stdout);"
  ].join(String.fromCharCode(10)));
  const command='"'+process.execPath+'" "'+hook+'"';
  git(cwd,'config','filter.uss-audit.clean',command);

  const created=run(cwd,'create');
  assert.equal(created.status,0,created.stderr);
  assert.equal(fs.existsSync(marker),false,'Checksum creation must not execute configured clean filters');
  const verified=run(cwd,'verify');
  assert.equal(verified.status,0,verified.stderr);
  assert.equal(fs.existsSync(marker),false,'Checksum verification must not execute configured clean filters');
});

test('adversarial: rejects a tracked file reached through a symbolic-link parent directory',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const policyDir=path.join(cwd,'policy');
  fs.mkdirSync(policyDir);
  fs.writeFileSync(path.join(policyDir,'README.md'),'trusted nested policy'+String.fromCharCode(10));
  git(cwd,'add','policy/README.md');
  git(cwd,'commit','-m','add nested policy fixture');
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');
  git(cwd,'commit','-m','add checksum manifest');

  const target=fs.mkdtempSync(path.join(os.tmpdir(),'uss-parent-symlink-target-'));
  t.after(()=>fs.rmSync(target,{recursive:true,force:true}));
  fs.writeFileSync(path.join(target,'README.md'),'trusted nested policy'+String.fromCharCode(10));
  fs.rmSync(policyDir,{recursive:true,force:true});
  fs.symlinkSync(target,policyDir,process.platform==='win32'?'junction':'dir');

  const result=run(cwd,'verify');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/symbolic-link parent/);
});


test('adversarial: rejects .git metadata at the selected vendored root in Git mode',t=>{
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const vendor=path.join(cwd,'vendor','uss');
  fs.mkdirSync(vendor,{recursive:true});
  fs.writeFileSync(path.join(vendor,'KERNEL.md'),'vendored policy content'+String.fromCharCode(10));
  git(cwd,'add','vendor/uss/KERNEL.md');
  git(cwd,'commit','-m','add vendored USS fixture');

  // A selected subdirectory is not the outer repository root. Its own .git
  // directory must therefore be treated as nested, untrusted Git metadata.
  fs.mkdirSync(path.join(vendor,'.git','hooks'),{recursive:true});
  fs.writeFileSync(path.join(vendor,'.git','config'),'[core]'+String.fromCharCode(10));
  const directoryResult=run(cwd,'create','--root','vendor/uss');
  assert.notEqual(directoryResult.status,0,'Creation must reject .git directory at selected vendored root');
  assert.match(directoryResult.stderr,/Unexpected nested \.git directory or gitfile/);

  fs.rmSync(path.join(vendor,'.git'),{recursive:true,force:true});
  fs.writeFileSync(path.join(vendor,'.git'),'gitdir: ../../.git/modules/uss'+String.fromCharCode(10));
  const gitfileResult=run(cwd,'verify','--root','vendor/uss');
  assert.notEqual(gitfileResult.status,0,'Verification must reject .git gitfile at selected vendored root');
  assert.match(gitfileResult.stderr,/Unexpected nested \.git directory or gitfile/);
});


test('adversarial: Git-mode checksum verification detects executable-bit changes',t=>{
  if(process.platform==='win32'){t.skip('Windows worktrees do not reliably expose Git executable mode through stat');return;}
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'create').status,0);
  git(cwd,'add','SHA256SUMS');git(cwd,'commit','-m','add manifest');
  fs.chmodSync(path.join(cwd,'README.md'),0o755);
  const result=run(cwd,'verify');
  assert.notEqual(result.status,0,'Verification must reject executable-bit drift');
  assert.match(result.stderr,/executable mode differs from committed HEAD|SHA-256 mismatch/);
});

test('adversarial: filesystem checksum binds executable mode to the digest',t=>{
  if(process.platform==='win32'){t.skip('Windows does not reliably expose POSIX executable mode');return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-mode-fs-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'mode-bound content\\n',{mode:0o644});
  assert.equal(run(dir,'create','--filesystem').status,0);
  fs.chmodSync(path.join(dir,'README.md'),0o755);
  const result=run(dir,'verify','--filesystem');
  assert.notEqual(result.status,0,'Filesystem verification must reject executable-bit drift');
  assert.match(result.stderr,/SHA-256 mismatch: README\.md/);
});

test('adversarial: root .git metadata failure is controlled and has no uncaught stack trace',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-git-controlled-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'README.md'),'main doc\\n');
  fs.mkdirSync(path.join(dir,'.git'),{recursive:true});
  fs.writeFileSync(path.join(dir,'.git','config'),'[core]\\n');
  const result=run(dir,'verify','--filesystem');
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/^Checksum operation failed: Root \.git metadata is not allowed in filesystem mode/);
  assert.doesNotMatch(result.stderr,/\n\s+at /);
});

test('adversarial: Linux filesystem mode stays bound to the opened root after its path is atomically redirected',t=>{
  if(process.platform!=='linux'){t.skip('Linux /proc/self/fd descriptor traversal is required');return;}
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-race-'));
  const moved=parent+'.moved';
  const evilParent=fs.mkdtempSync(path.join(os.tmpdir(),'uss-root-evil-'));
  t.after(()=>{fs.rmSync(parent,{recursive:true,force:true});fs.rmSync(moved,{recursive:true,force:true});fs.rmSync(evilParent,{recursive:true,force:true});});
  const root=path.join(parent,'root');
  const evilRoot=path.join(evilParent,'root');
  fs.mkdirSync(root,{recursive:true});
  fs.mkdirSync(evilRoot,{recursive:true});
  fs.writeFileSync(path.join(root,'README.md'),'trusted root bytes\\n');
  fs.writeFileSync(path.join(evilRoot,'README.md'),'attacker root bytes\\n');
  const hook=path.join(os.tmpdir(),'uss-root-swap-'+process.pid+'.cjs');
  t.after(()=>fs.rmSync(hook,{force:true}));
  fs.writeFileSync(hook,`
const fs=require('node:fs');
let swapped=false;
const original=fs.readdirSync;
fs.readdirSync=function(target,...args){
  if(!swapped&&typeof target==='string'&&target.startsWith('/proc/self/fd/')){
    swapped=true;
    fs.renameSync(process.env.USS_TEST_PARENT,process.env.USS_TEST_MOVED);
    fs.symlinkSync(process.env.USS_TEST_EVIL_PARENT,process.env.USS_TEST_PARENT,'dir');
  }
  return original.call(this,target,...args);
};
`);
  const result=runWithPreload(process.cwd(),hook,'create',{
    USS_TEST_PARENT:parent,USS_TEST_MOVED:moved,USS_TEST_EVIL_PARENT:evilParent
  },'--root',root,'--filesystem');
  assert.equal(result.status,0,result.stderr);
  assert.equal(fs.existsSync(path.join(moved,'root','SHA256SUMS')),true,'Manifest must be written into the directory pinned before the path swap');
  assert.equal(fs.existsSync(path.join(evilRoot,'SHA256SUMS')),false,'Manifest must never be written into the attacker-controlled replacement tree');
});

test('adversarial: Linux filesystem verification reads the pinned root after an ancestor swap',t=>{
  if(process.platform!=='linux'){t.skip('Linux /proc/self/fd descriptor traversal is required');return;}
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'uss-verify-root-race-'));
  const moved=parent+'.moved';
  const evilParent=fs.mkdtempSync(path.join(os.tmpdir(),'uss-verify-evil-'));
  t.after(()=>{fs.rmSync(parent,{recursive:true,force:true});fs.rmSync(moved,{recursive:true,force:true});fs.rmSync(evilParent,{recursive:true,force:true});});
  const root=path.join(parent,'root');
  const evilRoot=path.join(evilParent,'root');
  fs.mkdirSync(root,{recursive:true});
  fs.mkdirSync(evilRoot,{recursive:true});
  fs.writeFileSync(path.join(root,'README.md'),'trusted verify bytes\\n');
  assert.equal(run(process.cwd(),'create','--root',root,'--filesystem').status,0);
  fs.writeFileSync(path.join(evilRoot,'README.md'),'attacker bytes\\n');
  // The replacement tree deliberately has no manifest. Verification must read
  // the manifest from the already-open original root, not re-resolve this path.
  const hook=path.join(os.tmpdir(),'uss-verify-root-swap-'+process.pid+'.cjs');
  t.after(()=>fs.rmSync(hook,{force:true}));
  fs.writeFileSync(hook,`
const fs=require('node:fs');
let swapped=false;
const original=fs.readdirSync;
fs.readdirSync=function(target,...args){
  if(!swapped&&typeof target==='string'&&target.startsWith('/proc/self/fd/')){
    swapped=true;
    fs.renameSync(process.env.USS_TEST_PARENT,process.env.USS_TEST_MOVED);
    fs.symlinkSync(process.env.USS_TEST_EVIL_PARENT,process.env.USS_TEST_PARENT,'dir');
  }
  return original.call(this,target,...args);
};
`);
  const result=runWithPreload(process.cwd(),hook,'verify',{
    USS_TEST_PARENT:parent,USS_TEST_MOVED:moved,USS_TEST_EVIL_PARENT:evilParent
  },'--root',root,'--filesystem');
  assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(path.join(moved,'root','SHA256SUMS'),'utf8').includes('README.md'),true);
});

test('adversarial: Linux filesystem mode fails closed when a leaf is replaced after opening',t=>{
  if(process.platform!=='linux'){t.skip('Linux /proc/self/fd descriptor traversal is required');return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'uss-leaf-race-'));
  const evil=fs.mkdtempSync(path.join(os.tmpdir(),'uss-leaf-evil-'));
  t.after(()=>{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(evil,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'README.md'),'trusted leaf bytes\\n');
  fs.writeFileSync(path.join(evil,'README.md'),'attacker leaf bytes\\n');
  const hook=path.join(os.tmpdir(),'uss-leaf-swap-'+process.pid+'.cjs');
  t.after(()=>fs.rmSync(hook,{force:true}));
  fs.writeFileSync(hook,`
const fs=require('node:fs');
let swapped=false;
const original=fs.openSync;
fs.openSync=function(target,...args){
  const fd=original.call(this,target,...args);
  if(!swapped&&typeof target==='string'&&target.endsWith('/README.md')){
    swapped=true;
    fs.renameSync(process.env.USS_TEST_FILE,process.env.USS_TEST_BACKUP);
    fs.symlinkSync(process.env.USS_TEST_EVIL_FILE,process.env.USS_TEST_FILE);
  }
  return fd;
};
`);
  const file=path.join(root,'README.md');
  const result=runWithPreload(process.cwd(),hook,'create',{
    USS_TEST_FILE:file,USS_TEST_BACKUP:file+'.original',USS_TEST_EVIL_FILE:path.join(evil,'README.md')
  },'--root',root,'--filesystem');
  assert.notEqual(result.status,0,'A leaf replacement during hashing must not be accepted');
  assert.match(result.stderr,/ELOOP|symbolic link|File path changed/);
});

test('adversarial: checksum Git calls ignore inherited GIT environment overrides',t=>{
  const cwd=fixture();
  const decoy=fs.mkdtempSync(path.join(os.tmpdir(),'uss-checksums-decoy-'));
  t.after(()=>{fs.rmSync(cwd,{recursive:true,force:true});fs.rmSync(decoy,{recursive:true,force:true});});
  git(decoy,'init','-q');
  const env={
    GIT_DIR:path.join(decoy,'.git'),
    git_dir:path.join(decoy,'.git'),
    Git_Index_File:path.join(decoy,'case-variant.index'),
    GIT_WORK_TREE:decoy,
    GIT_INDEX_FILE:path.join(decoy,'empty.index'),
    GIT_OBJECT_DIRECTORY:path.join(decoy,'.git','objects'),
    GIT_ALTERNATE_OBJECT_DIRECTORIES:path.join(decoy,'.git','objects'),
    GIT_COMMON_DIR:path.join(decoy,'.git'),
    GIT_CEILING_DIRECTORIES:decoy,
    GIT_NAMESPACE:'attacker',
    GIT_EXEC_PATH:path.join(decoy,'no-git-execs'),
    GIT_SSH_COMMAND:'exit 99'
  };
  const created=runWithEnv(cwd,'create',env);
  assert.equal(created.status,0,created.stderr);
  assert.equal(fs.existsSync(path.join(cwd,'SHA256SUMS')),true);
  const verified=runWithEnv(cwd,'verify',env);
  assert.equal(verified.status,0,verified.stderr);
});



test('W-04: ignores hostile PATH Git and inherited GIT_* overrides',t=>{
  if(process.platform!=='linux'){t.skip('Trusted absolute Git resolution is Linux-only; unsupported platforms fail closed');return;}
  const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
  const attacker=fs.mkdtempSync(path.join(os.tmpdir(),'uss-fake-git-path-'));
  t.after(()=>fs.rmSync(attacker,{recursive:true,force:true}));
  const marker=path.join(attacker,'executed.txt');
  const fakeGit=path.join(attacker,'git');
  fs.writeFileSync(fakeGit,'#!/bin/sh\\nprintf executed > '+JSON.stringify(marker)+'\\nexit 97\\n');
  fs.chmodSync(fakeGit,0o755);
  const result=runWithEnv(cwd,'create',{
    PATH:attacker,
    GIT_DIR:path.join(attacker,'attacker.git'),
    GIT_WORK_TREE:attacker,
    GIT_INDEX_FILE:path.join(attacker,'attacker.index'),
    GIT_OBJECT_DIRECTORY:path.join(attacker,'objects'),
    GIT_ALTERNATE_OBJECT_DIRECTORIES:path.join(attacker,'alternate'),
    GIT_CONFIG_COUNT:'1',
    GIT_CONFIG_KEY_0:'core.fsmonitor',
    GIT_CONFIG_VALUE_0:fakeGit
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(fs.readFileSync(path.join(cwd,'SHA256SUMS'),'utf8'),/README\.md/);
  assert.equal(fs.existsSync(marker),false,'Checksum operation must not execute Git found through hostile PATH');
});

test('W04-F1: unsupported Git platform fails closed without an uncaught stack trace',t=>{
 const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
 const shim=path.join(cwd,'fake-platform.cjs');
 fs.writeFileSync(shim, "Object.defineProperty(process,'platform',{value:'darwin'});" + String.fromCharCode(10));
 const result=spawnSync(process.execPath,['--require',shim,TOOL,'create'],{cwd,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/Checksum Git mode is supported only on Linux; refusing to use PATH-based Git/);
 assert.doesNotMatch(result.stderr,/\\n\\s+at /,'must not print an uncaught stack trace');
});

test('W04-F1: filesystem mode reports unsupported root traversal cleanly on non-Linux',t=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'uss-checksums-platform-'));
 t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
 fs.writeFileSync(path.join(cwd,'README.md'),'filesystem snapshot\\n');
 const shim=path.join(cwd,'fake-platform.cjs');
 fs.writeFileSync(shim, "Object.defineProperty(process,'platform',{value:'darwin'});" + String.fromCharCode(10));
 const result=spawnSync(process.execPath,['--require',shim,TOOL,'create','--filesystem'],{cwd,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/Checksum operation failed: Race-resistant checksum root traversal is unsupported on this platform/);
 assert.doesNotMatch(result.stderr,/\\n\\s+at /,'must not print an uncaught stack trace');
});

test('W04-F3: manifest replacement does not modify an existing hardlink',t=>{
 const cwd=fixture();t.after(()=>fs.rmSync(cwd,{recursive:true,force:true}));
 const manifest=path.join(cwd,'SHA256SUMS');
 const external=path.join(os.tmpdir(),'uss-checksums-hardlink-'+process.pid+'-'+Date.now());
 t.after(()=>fs.rmSync(external,{force:true}));
 const old='previous manifest inode\\n';
 fs.writeFileSync(manifest,old);
 fs.linkSync(manifest,external);
 const result=run(cwd,'create');
 assert.equal(result.status,0,result.stderr);
 assert.equal(fs.readFileSync(external,'utf8'),old,'the pre-existing hardlink must retain its original bytes');
 assert.notEqual(fs.readFileSync(manifest,'utf8'),old,'SHA256SUMS must be replaced with the new manifest');
 assert.notEqual(fs.statSync(manifest).ino,fs.statSync(external).ino,'new manifest must have a different inode');
});

test('W04-F2: trusted Git executable policy rejects writable and foreign-owned candidates',()=>{
 const currentUid=1000;
 const fakeFile=(mode,uid)=>({mode,uid,isFile:()=>true});
 assert.equal(isTrustedExecutableStat(fakeFile(0o100755,0),currentUid),true,'root-owned non-writable executable is trusted');
 assert.equal(isTrustedExecutableStat(fakeFile(0o100755,currentUid),currentUid),true,'current-user-owned non-writable executable is trusted');
 assert.equal(isTrustedExecutableStat(fakeFile(0o100775,0),currentUid),false,'group-writable fake Git is rejected');
 assert.equal(isTrustedExecutableStat(fakeFile(0o100757,0),currentUid),false,'world-writable fake Git is rejected');
 assert.equal(isTrustedExecutableStat(fakeFile(0o100755,2000),currentUid),false,'foreign-owned fake Git is rejected');
 assert.equal(isTrustedExecutableStat(fakeFile(0o100644,0),currentUid),false,'non-executable Git candidate is rejected');
});

test('W04-F2: trusted Git parent-directory policy rejects writable and foreign-owned directories',()=>{
 const currentUid=1000;
 const fakeDirectory=(mode,uid)=>({mode,uid,isDirectory:()=>true});
 assert.equal(isTrustedDirectoryStat(fakeDirectory(0o40755,0),currentUid),true,'root-owned non-writable directory is trusted');
 assert.equal(isTrustedDirectoryStat(fakeDirectory(0o40755,currentUid),currentUid),true,'current-user-owned non-writable directory is trusted');
 assert.equal(isTrustedDirectoryStat(fakeDirectory(0o40775,0),currentUid),false,'group-writable parent directory is rejected');
 assert.equal(isTrustedDirectoryStat(fakeDirectory(0o40777,0),currentUid),false,'world-writable parent directory is rejected');
 assert.equal(isTrustedDirectoryStat(fakeDirectory(0o40755,2000),currentUid),false,'foreign-owned parent directory is rejected');
});
