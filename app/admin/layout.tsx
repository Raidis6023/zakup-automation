import type {
  ReactNode,
} from "react";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/server";


type AdminLayoutProps = {
  children: ReactNode;
};


type ProfileAccessRow = {
  has_admin_access: boolean;
};


export default async function AdminLayout({
  children,
}: AdminLayoutProps) {

  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase
      .auth
      .getUser();


  if (
    userError
    ||
    !user
  ) {

    redirect(
      "/login"
    );

  }


  const {
    data,
    error,
  } =
    await supabase
      .rpc(
        "app_get_my_profile"
      );


  if (
    error
  ) {

    redirect(
      "/"
    );

  }


  const rawProfile =
    Array.isArray(
      data
    )

      ? data[0]

      : data;


  const profile =
    rawProfile as
      ProfileAccessRow
      |
      null
      |
      undefined;


  if (
    !profile
    ||
    !profile.has_admin_access
  ) {

    redirect(
      "/"
    );

  }


  return (
    <>
      {children}
    </>
  );

}
