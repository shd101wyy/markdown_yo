{ pkgs, config, ... }:
{
  dotenv.enable = false;

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;

    bun.enable = true;
  };

  packages = with pkgs; [
    bash # GNU Bourne-Again Shell
    clang
    gdb
    pkg-config
    emscripten
  ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
    liburing
  ];

  enterShell = ''
  '';

}
