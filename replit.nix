{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.nodePackages.pnpm
    pkgs.openssl
    pkgs.cacert
    pkgs.git
    pkgs.postgresql
  ];
}
