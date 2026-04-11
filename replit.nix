{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.nodePackages.pnpm
    pkgs.openssl
    pkgs.git
    pkgs.postgresql
  ];
}
