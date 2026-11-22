import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
