FROM centos

SHELL [ "/bin/bash", "-l", "-c" ]
RUN dnf install -y epel-release || sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(cut -d: -f5 /etc/system-release-cpe | cut -d. -f1).noarch.rpm \
  && dnf install -y https://apache.jfrog.io/artifactory/arrow/centos/$(cut -d: -f5 /etc/system-release-cpe | cut -d. -f1)/apache-arrow-release-latest.rpm \
  && dnf config-manager --set-enabled epel || : \
  && dnf config-manager --set-enabled powertools || : \
  && dnf config-manager --set-enabled codeready-builder-for-rhel-$(cut -d: -f5 /etc/system-release-cpe | cut -d. -f1)-rhui-rpms || : \
  && subscription-manager repos --enable codeready-builder-for-rhel-$(cut -d: -f5 /etc/system-release-cpe | cut -d. -f1)-$(arch)-rpms || : \
  && dnf install -y arrow-devel \
  && dnf install -y arrow-glib-devel \
  && dnf install -y curl gpg gcc gcc-c++ make patch autoconf automake bison libffi-devel libtool patch readline-devel sqlite-devel zlib-devel openssl-devel which \
  && gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB \
  && curl -sSL https://get.rvm.io | bash -s stable \
  && . /etc/profile.d/rvm.sh \
  && rvm install 2.4.1 \
  && rvm use 2.4.1 --default 

RUN mkdir /usr/src/csv2arrow
ADD . /usr/src/csv2arrow/
WORKDIR /usr/src/csv2arrow/
COPY ./csv2arrow/ .
RUN ruby install.rb
