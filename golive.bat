set IMAGE_NAME=cr-rex
set CREDENTIALS=ubuntu@pi

rem build image
docker build --pull --rm -f "Dockerfile" -t %IMAGE_NAME%:latest "."

set PATH=c:\Program Files (x86)\GnuWin32\bin;%PATH%

rem upload image to raspberri pi
docker save %IMAGE_NAME% | bzip2 | ssh %CREDENTIALS% "bunzip2 | sudo docker load"
