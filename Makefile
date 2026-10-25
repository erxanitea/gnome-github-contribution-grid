NAME=github-contribution-grid@erxanitea
ZIP_NAME=$(NAME).shell-extension.zip

.PHONY: all pack install clean pot

all: schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.github-contribution-grid.gschema.xml
	glib-compile-schemas schemas

po/$(NAME).pot: po/POTFILES.in extension.js prefs.js schemas/org.gnome.shell.extensions.github-contribution-grid.gschema.xml
	xgettext --from-code=UTF-8 \
		--package-name="Github Contribution Grid" \
		--output=$@ \
		--files-from=$< \
		--keyword=_ \
		--keyword=C_:1c,2 \
		--keyword=N_ \
		--keyword=ngettext:1,2

pot: po/$(NAME).pot

$(ZIP_NAME): extension.js prefs.js colorThemes.js contributionData.js schemas/gschemas.compiled metadata.json stylesheet.css
	gnome-extensions pack \
		--extra-source=colorThemes.js \
		--extra-source=contributionData.js \
		--schema=schemas/org.gnome.shell.extensions.github-contribution-grid.gschema.xml \
		--podir=po \
		--force \
		.

pack: $(ZIP_NAME)

install: $(ZIP_NAME)
	gnome-extensions install --force $(ZIP_NAME)

clean:
	@rm -f $(ZIP_NAME) $(NAME).zip schemas/gschemas.compiled

