Name:           cockpit-samba-manager
Version:        1.0.0
Release:        1%{?dist}
Summary:        A Cockpit plugin to make managing SMB shares easy.

License:        GPL-3.0+
URL:            github.com/45drives/cockpit-samba-manager/blob/main/README.md
Source0:        %{name}-%{version}.tar.gz

BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root

%description
Cockpit Samba Manager
A Cockpit plugin to make managing SMB shares easy.

%prep
%setup -q

%build
# empty

%install
rm -rf %{buildroot}
mkdir -p  %{buildroot}
cp -a * %{buildroot}

%clean
rm -rf %{buildroot}

%files
/usr/share/cockpit/samba-manager/*

%changelog
* Thu Apr 01 2021 Josh Boudreau <jboudreau@45drives.com> 1.0.0
- First Build
