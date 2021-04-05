default:
	

all: default

install:
	mkdir -p $(DESTDIR)/usr/share/cockpit/
	cp -rf samba-manager $(DESTDIR)/usr/share/cockpit
ifeq ($(EL7),1)
	cat samba-manager/button-fallbacks-el7.css >> $(DESTDIR)/usr/share/cockpit/samba-manager/samba-manager.css
endif
	command -v minify && for i in $(DESTDIR)/usr/share/cockpit/samba-manager/{*.js,*.css}; do minify -o $$i $$i; done

uninstall:
	rm -rf $(DESTDIR)/usr/share/cockpit/samba-manager

install-local:
	mkdir -p $(HOME)/.local/share/cockpit
	cp -rf samba-manager $(HOME)/.local/share/cockpit
	sed -i "s#/usr/share/cockpit/samba-manager/set_parms.py#$(HOME)/.local/share/cockpit/samba-manager/set_parms.py#" $(HOME)/.local/share/cockpit/samba-manager/samba-manager.js
	sed -i "s#/usr/share/cockpit/samba-manager/del_parms.py#$(HOME)/.local/share/cockpit/samba-manager/del_parms.py#" $(HOME)/.local/share/cockpit/samba-manager/samba-manager.js

make uninstall-local:
	rm -rf $(HOME)/.local/share/cockpit/samba-manager
