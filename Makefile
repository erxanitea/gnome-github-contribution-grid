NAME=github-contribution-grid@erxanitea
ZIP_NAME=$(NAME).shell-extension.zip

.PHONY: all pack install clean

all: schemas/gschemas.compiled

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.github-contribution-grid.gschema.xml
	glib-compile-schemas schemas

$(ZIP_NAME): extension.js prefs.js colorThemes.js contributionData.js schemas/gschemas.compiled metadata.json stylesheet.css
	gnome-extensions pack \
		--extra-source=colorThemes.js \
		--extra-source=contributionData.js \
		--schema=schemas/org.gnome.shell.extensions.github-contribution-grid.gschema.xml \
		--force \
		.

pack: $(ZIP_NAME)

install: $(ZIP_NAME)
	gnome-extensions install --force $(ZIP_NAME)

clean:
	@rm -f $(ZIP_NAME) $(NAME).zip schemas/gschemas.compiled

