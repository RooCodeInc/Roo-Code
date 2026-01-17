# Roo Code Nix Flake
#
# Provides a reproducible development environment
#
# Usage:
#   nix develop          # Enter dev shell
#   nix run              # Show welcome banner
#   nix fmt              # Format nix files
#   nix flake check      # Run all checks (lint, typecheck, test)
#
# Build and install extension:
#   nix build .#vsix && code --install-extension result/*.vsix
#
# Inside dev shell:
#   pnpm install         # Install npm packages
#   pnpm build           # Build the project
#   pnpm test            # Run tests
#   pnpm vsix            # Create VS Code extension
#
# Maintenance:
#   nix run .#update-deps   # Update flake.lock and pnpmDeps hash
#
# If flakes aren't enabled, prefix commands with:
#   nix --extra-experimental-features 'nix-command flakes' <command>
#
# See README.md section "Nix Flake" for more information

{
  description = "Roo Code - AI-Powered Dev Team, Right in Your Editor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    let
      versionFromPackageJson = (builtins.fromJSON (builtins.readFile ./src/package.json)).version;

    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;

        nodejs = pkgs.nodejs_20;
        pnpm = pkgs.pnpm;

        ignoredPaths = [
          ".direnv"
          "result"
          "result-dev"
          "node_modules"
          ".turbo"
          "dist"
          "bin"
          ".vscode"
          ".cursor"
        ];

        src = lib.cleanSourceWith {
          src = lib.cleanSource ./.;
          filter =
            path: type:
            let
              baseName = builtins.baseNameOf path;
            in
            !(builtins.elem baseName ignoredPaths);
        };

        chromiumPath =
          if pkgs.stdenv.isDarwin then
            "${pkgs.chromium}/Applications/Chromium.app/Contents/MacOS/Chromium"
          else
            "${pkgs.chromium}/bin/chromium";

        basePnpmAttrs = {
          inherit src;
          strictDeps = true;
          nativeBuildInputs = [
            nodejs
            pnpm
            pkgs.pnpmConfigHook
          ];
          pnpmDeps = self.packages.${system}.pnpmDeps;
        };

        roo-code-welcome = pkgs.writeShellApplication {
          name = "roo-code-welcome";
          runtimeInputs = [
            pkgs.jp2a
            nodejs
            pnpm
          ];
          text = ''
            echo ""
            if [ -f "./src/assets/images/roo.png" ]; then
              jp2a --colors --width=40 ./src/assets/images/roo.png 2>/dev/null || echo "🦘 Roo Code"
            else
              echo "🦘 Roo Code Development Environment"
            fi
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "Node.js: $(node --version)"
            echo "pnpm:    $(pnpm --version)"
            echo ""
            echo "📦 pnpm install    - Install dependencies"
            echo "🔧 pnpm build      - Build the project"
            echo "📋 pnpm test       - Run tests"
            echo "📦 pnpm vsix       - Create VS Code extension"
            echo ""
            echo "For VS Code debugging: Press F5"
            echo ""
          '';
        };

        mkPnpmCheck =
          name: script: extraAttrs:
          pkgs.stdenvNoCC.mkDerivation (
            basePnpmAttrs
            // {
              name = "roo-code-${name}";
              buildPhase = ''
                runHook preBuild
                export HOME=$TMPDIR
                # Disable pnpm self-management (pnpm is provided by Nix)
                echo "manage-package-manager-versions=false" >> .npmrc
                pnpm run ${script}
                runHook postBuild
              '';
              installPhase = ''
                mkdir -p $out
                echo "${name} passed" > $out/result
              '';
            }
            // extraAttrs
          );

      in
      {
        formatter = pkgs.nixfmt-tree;

        devShells.default = pkgs.mkShell {
          name = "roo-code-dev";

          packages = with pkgs; [
            nodejs
            pnpm
            git
            python3
            pkg-config
            gnumake
            turbo
            chromium
            ripgrep
            jp2a
            nodePackages.typescript-language-server
            nil
          ];

          buildInputs =
            with pkgs;
            [
              openssl
            ]
            ++ lib.optionals stdenv.isLinux [
              stdenv.cc.cc.lib
            ];

          env = {
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1";
            PUPPETEER_EXECUTABLE_PATH = chromiumPath;
            RIPGREP_PATH = "${pkgs.ripgrep}/bin/rg";
            NODE_ENV = "development";
          };

          shellHook = ''
            ${lib.getExe roo-code-welcome}
          '';
        };

        packages =
          let
            version = versionFromPackageJson;
          in
          {
            # Pre-fetch pnpm dependencies (for reproducible builds)
            # Update hash when pnpm-lock.yaml changes:
            #   1. Set hash = lib.fakeHash;
            #   2. Run: nix build .#pnpmDeps
            #   3. Copy the "got:" hash from the error message
            pnpmDeps = pkgs.fetchPnpmDeps {
              pname = "roo-code-pnpm-deps";
              inherit version src;
              fetcherVersion = 2;
              hash = "sha256-AuDK65r2lanMp9sj9JdTljYIQ06goT08AxwcG+LawgI=";
            };

            vsix = pkgs.stdenvNoCC.mkDerivation (
              basePnpmAttrs
              // {
                pname = "roo-code-vsix";
                inherit version;

                buildPhase = ''
                  runHook preBuild
                  export HOME=$TMPDIR
                  # Disable pnpm self-management (pnpm is provided by Nix)
                  echo "manage-package-manager-versions=false" >> .npmrc
                  pnpm run vsix
                  runHook postBuild
                '';

                installPhase = ''
                  runHook preInstall
                  mkdir -p $out
                  cp -v bin/*.vsix $out/
                  runHook postInstall
                '';

                meta = with lib; {
                  description = "AI-powered autonomous coding agent that lives in your editor";
                  homepage = "https://github.com/RooCodeInc/Roo-Code";
                  license = licenses.asl20;
                  platforms = platforms.unix;
                };
              }
            );

            default = self.packages.${system}.vsix;
          };

        apps = {
          welcome = {
            type = "app";
            program = lib.getExe roo-code-welcome;
          };

          build-vsix = {
            type = "app";
            program = lib.getExe (
              pkgs.writeShellApplication {
                name = "build-vsix";
                text = ''
                  echo "Building VSIX..."
                  nix build .#vsix --print-out-paths
                '';
              }
            );
          };

          update-deps = {
            type = "app";
            program = lib.getExe (
              pkgs.writeShellApplication {
                name = "update-deps";
                runtimeInputs = [
                  pkgs.gnused
                  pkgs.gnugrep
                ];
                text = ''
                  # Safety check: ensure flake.nix has no uncommitted changes
                  if ! git diff --quiet flake.nix 2>/dev/null; then
                    echo "Error: flake.nix has uncommitted changes. Commit or stash them first."
                    exit 1
                  fi

                  echo "==> Updating flake inputs (nixpkgs, flake-utils)..."
                  nix flake update

                  echo ""
                  echo "==> Updating pnpmDeps hash..."

                  # Set hash to empty to trigger rebuild
                  sed -i 's|hash = "sha256-[^"]*";|hash = "";|' flake.nix

                  # Build and capture the error output
                  if output=$(nix build .#pnpmDeps 2>&1); then
                    echo "Build succeeded - hash unchanged"
                    # Restore the original hash since build succeeded
                    git checkout flake.nix 2>/dev/null || true
                    exit 0
                  fi

                  # Extract the correct hash from "got: sha256-..." (with fallback patterns)
                  new_hash=$(echo "$output" | grep -oP 'got:\s+\Ksha256-[A-Za-z0-9+/=]+' | head -1)

                  # Fallback: try alternative pattern if first didn't match
                  if [ -z "$new_hash" ]; then
                    new_hash=$(echo "$output" | grep -oE 'sha256-[A-Za-z0-9+/=]+' | tail -1)
                  fi

                  if [ -z "$new_hash" ]; then
                    echo "Error: Could not extract hash from build output"
                    echo "$output"
                    # Restore flake.nix since we failed
                    git checkout flake.nix 2>/dev/null || true
                    exit 1
                  fi

                  # Update flake.nix with the new hash
                  sed -i "s|hash = \"\";|hash = \"$new_hash\";|" flake.nix

                  echo "Updated pnpmDeps hash to: $new_hash"
                  echo ""
                  echo "Run 'nix fmt' to format, then commit flake.nix and flake.lock"
                '';
              }
            );
          };

          default = self.apps.${system}.welcome;
        };

        checks = {
          lint = mkPnpmCheck "lint" "lint" { };
          typecheck = mkPnpmCheck "typecheck" "check-types" { };
          test = mkPnpmCheck "test" "test" {
            nativeBuildInputs = basePnpmAttrs.nativeBuildInputs ++ [ pkgs.chromium ];
            CI = "true";
            PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "1";
            PUPPETEER_EXECUTABLE_PATH = chromiumPath;
          };

          format = pkgs.stdenvNoCC.mkDerivation {
            name = "roo-code-format-check";
            src = ./.;
            strictDeps = true;

            nativeBuildInputs = [ pkgs.nixfmt-tree ];

            buildPhase = ''
              runHook preBuild
              nixfmt --check flake.nix
              runHook postBuild
            '';

            installPhase = ''
              mkdir -p $out
              echo "Format check passed" > $out/result
            '';
          };
        };
      }
    )
    // {
      overlays.default = final: prev: {
        roo-code-vsix = self.packages.${final.system}.vsix;
      };
    };
}
