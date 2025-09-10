# SSH Key Setup Guide for DigitalOcean Droplet

## 🔑 Why SSH Keys Are Better Than Passwords

✅ **More Secure** - No password to guess or crack  
✅ **Convenient** - No typing passwords every time  
✅ **Required** - Many cloud providers prefer/require SSH keys  
✅ **Industry Standard** - Professional way to manage server access  

## 🖥️ Step-by-Step SSH Key Creation

### **Step 1: Open Terminal/Command Prompt**

**On Windows:**
- Press `Win + R`, type `cmd`, press Enter
- OR use PowerShell: Press `Win + X`, select "Windows PowerShell"
- OR use Git Bash if you have Git installed

**On Mac/Linux:**
- Press `Cmd + Space`, type "Terminal", press Enter
- OR use any terminal application

### **Step 2: Generate SSH Key Pair**

Run this command (replace with your email):
```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

**What this does:**
- `-t rsa` = Use RSA encryption
- `-b 4096` = Use 4096-bit key (very secure)
- `-C "email"` = Add a comment to identify the key

### **Step 3: Choose Key Location**

You'll see this prompt:
```
Enter file in which to save the key (/Users/yourusername/.ssh/id_rsa):
```

**Options:**
- **Press Enter** = Use default location (recommended)
- **Custom name** = Type something like `/Users/yourusername/.ssh/tink_droplet_key`

### **Step 4: Set Passphrase (Optional but Recommended)**

You'll see:
```
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
```

**Recommendation:**
- **Enter a passphrase** = Extra security layer
- **Leave empty** = More convenient but less secure

### **Step 5: Key Generation Complete**

You'll see output like:
```
Your identification has been saved in /Users/yourusername/.ssh/id_rsa
Your public key has been saved in /Users/yourusername/.ssh/id_rsa.pub
The key fingerprint is:
SHA256:abc123def456... your-email@example.com
```

## 📋 Step 6: Copy Your Public Key

### **Method 1: Using cat command (Mac/Linux/Git Bash)**
```bash
cat ~/.ssh/id_rsa.pub
```

### **Method 2: Using type command (Windows Command Prompt)**
```cmd
type %USERPROFILE%\.ssh\id_rsa.pub
```

### **Method 3: Manual file opening**
Navigate to:
- **Windows**: `C:\Users\YourUsername\.ssh\id_rsa.pub`
- **Mac/Linux**: `/Users/yourusername/.ssh/id_rsa.pub`

Open the `.pub` file in Notepad/TextEdit and copy all content.

### **Your public key looks like this:**
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDExample123456789... your-email@example.com
```

**⚠️ IMPORTANT: Only share the .pub file content, NEVER the private key!**

## 🌊 Step 7: Add SSH Key to DigitalOcean

### **Option A: During Droplet Creation**
1. Go to DigitalOcean → Create → Droplets
2. In the "Authentication" section, select "SSH keys"
3. Click "New SSH Key"
4. Paste your public key content
5. Give it a name like "Tink Server Key"
6. Click "Add SSH Key"
7. Continue with droplet creation

### **Option B: Add to Existing Account**
1. Go to DigitalOcean Dashboard
2. Click your profile → Settings
3. Go to "Security" tab
4. Click "Add SSH Key"
5. Paste your public key content
6. Name it "Tink Server Key"
7. Click "Add SSH Key"

## 🚀 Step 8: Test SSH Connection

Once your droplet is created, test the connection:

```bash
ssh root@YOUR_DROPLET_IP
```

**Replace YOUR_DROPLET_IP with your actual droplet IP address.**

### **First Connection:**
You'll see something like:
```
The authenticity of host 'YOUR_DROPLET_IP' can't be established.
ECDSA key fingerprint is SHA256:abc123def456...
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Type `yes` and press Enter.

### **Successful Connection:**
You should see:
```
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-88-generic x86_64)
root@tink-ml-sync-server:~#
```

## 🔧 Troubleshooting Common Issues

### **Issue 1: "Permission denied (publickey)"**
**Solution:**
```bash
# Make sure permissions are correct
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

### **Issue 2: "Connection refused"**
**Possible causes:**
- Wrong IP address
- Droplet not fully booted yet (wait 2-3 minutes)
- Firewall blocking SSH (port 22)

### **Issue 3: "Host key verification failed"**
**Solution:**
```bash
ssh-keygen -R YOUR_DROPLET_IP
```
Then try connecting again.

### **Issue 4: Using custom key name**
If you used a custom key name:
```bash
ssh -i ~/.ssh/tink_droplet_key root@YOUR_DROPLET_IP
```

## 🔒 Security Best Practices

### **1. Disable Password Authentication (After SSH key works)**
```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Find and change these lines:
PasswordAuthentication no
PermitRootLogin yes  # or 'no' if you create another user

# Restart SSH service
sudo systemctl restart sshd
```

### **2. Create Non-Root User (Recommended)**
```bash
# Create new user
adduser tinkadmin

# Add to sudo group
usermod -aG sudo tinkadmin

# Copy SSH key to new user
mkdir /home/tinkadmin/.ssh
cp ~/.ssh/authorized_keys /home/tinkadmin/.ssh/
chown -R tinkadmin:tinkadmin /home/tinkadmin/.ssh
chmod 700 /home/tinkadmin/.ssh
chmod 600 /home/tinkadmin/.ssh/authorized_keys
```

Then connect as:
```bash
ssh tinkadmin@YOUR_DROPLET_IP
```

### **3. Enable Firewall**
```bash
ufw allow ssh
ufw allow 3000/tcp  # For your Tink sync server
ufw --force enable
```

## 📱 SSH Key Management Tips

### **Multiple Keys for Different Servers**
Create different keys for different purposes:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/tink_droplet -C "tink-server-key"
ssh-keygen -t rsa -b 4096 -f ~/.ssh/personal_server -C "personal-server-key"
```

### **SSH Config File (Advanced)**
Create `~/.ssh/config`:
```
Host tink-server
    HostName YOUR_DROPLET_IP
    User root
    IdentityFile ~/.ssh/tink_droplet
    Port 22

Host tink-admin
    HostName YOUR_DROPLET_IP
    User tinkadmin
    IdentityFile ~/.ssh/tink_droplet
    Port 22
```

Then connect with:
```bash
ssh tink-server
# or
ssh tink-admin
```

## ✅ Quick Checklist

- [ ] SSH key pair generated
- [ ] Public key copied to clipboard
- [ ] SSH key added to DigitalOcean account
- [ ] Droplet created with SSH key
- [ ] Successfully connected via SSH
- [ ] Ready to install Tink sync server!

## 🎯 Next Steps

Once you can SSH into your droplet, you're ready to:
1. Install Node.js and dependencies
2. Deploy the Tink ML sync server
3. Configure firewall and security
4. Test connections from your stores

You now have secure, password-free access to your DigitalOcean droplet!
