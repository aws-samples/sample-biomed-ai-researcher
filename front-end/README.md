

# Setup your gitlab access
https://gitlab.pages.aws.dev/docs/Platform/ssh.html



# PaperPeer UI

This folder contains the code needed to initiate the PaperPeer front-end.

## 0. Pre-requisites

Setup gitlab SSH key for your machine 
https://docs.gitlab.com/ee/user/ssh.html
https://docs.gitlab.com/ee/user/ssh.html#generate-an-ssh-key-pair
https://docs.github.com/en/authentication/connecting-to-github-with-ssh/checking-for-existing-ssh-keys


This project requires `Node.js v22.0.0` and `npm 10.8.2`

```
# installs nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# download and install Node.js (you may need to restart the terminal)
nvm install 22



# You may have it alrrady instralled
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

# verifies the right Node.js version is in the environment
node -v # should print `v22.12.0`
# verifies the right npm version is in the environment
npm -v # should print `10.9.0`
```


## 1. Install packages

```
npm install -g vite
npm install
```

## 2. Build & Run

```
vite build
vite preview
```

## 3. Run with Hot reloading HMR

```
vite dev
```

