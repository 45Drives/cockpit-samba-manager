default:
	

all: default

install:
	mkdir -p $(DESTDIR)/usr/share/cockpit/
	cp -rf samba-manager $(DESTDIR)/usr/share/cockpit

uninstall:
	rm -rf $(DESTDIR)/usr/share/cockpit/samba-manager
