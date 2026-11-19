# Public signing-key verification files

This directory must contain `allowed_signers`, generated from the public key in the repository root file `SECURITY-ROOT.pub`.

The allowed-signers entry has this exact format:

```text
jude_m2003@yahoo.com ssh-ed25519 <base64-public-key>
```

To create it on the owner's Windows workstation:

```powershell
$pub = "$env:USERPROFILE\.ssh\security_layer_signing.pub"
$key = (Get-Content $pub -Raw).Trim()
$parts = $key -split '\s+'
New-Item -ItemType Directory -Force .security | Out-Null
Copy-Item $pub SECURITY-ROOT.pub -Force
"jude_m2003@yahoo.com $($parts[0]) $($parts[1])" |
    Set-Content .security/allowed_signers -Encoding ascii
ssh-keygen -lf SECURITY-ROOT.pub
```

The displayed fingerprint must match the independently trusted fingerprint in `SECURITY-ROOT.md`. These files contain public key material only. Never copy the private key or passphrase into the repository.
