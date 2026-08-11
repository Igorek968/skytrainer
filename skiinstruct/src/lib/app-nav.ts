import type { UserRole } from "@prisma/client";



export type AppNavArea = "instructor" | "admin" | "client" | "default";



export type AppNavLinks = {
  area: AppNavArea;
  dashboardHref: string;
  dashboardLabel: string;
  ordersHref: string;
  ordersLabel: string;
  /** Доп. пункт меню (анкета инструктора). */
  profileHref?: string;
  profileLabel?: string;
  /** Поиск инструктора и оформление заказа как клиент. */
  bookHref?: string;
  bookLabel?: string;
};

/** Куда ведёт логотип «Инструктор для тебя». */
export function resolveBrandingHref(pathname: string | null, role?: UserRole | string): string {
  const path = pathname ?? "";
  if (path.startsWith("/instructor") || path.startsWith("/admin")) {
    return "/client";
  }
  if (role === "INSTRUCTOR" || role === "ADMIN") {
    return "/client";
  }
  return "/client";
}



function navForRole(role: UserRole): AppNavLinks {

  if (role === "INSTRUCTOR") {
    return {
      area: "instructor",
      bookHref: "/client",
      bookLabel: "Заказать занятие",
      dashboardHref: "/instructor",
      dashboardLabel: "Кабинет",
      profileHref: "/instructor#profile",
      profileLabel: "Анкета",
      ordersHref: "/instructor/orders",
      ordersLabel: "Заказы",
    };
  }

  if (role === "ADMIN") {
    return {
      area: "admin",
      bookHref: "/client",
      bookLabel: "Заказать занятие",
      dashboardHref: "/admin/metrics",
      dashboardLabel: "Админ-панель",
      ordersHref: "/admin/orders",
      ordersLabel: "Заказы (админ)",
    };
  }

  return {

    area: "client",

    dashboardHref: "/client",

    dashboardLabel: "Кабинет клиента",

    profileHref: "/client/referral",

    profileLabel: "Рефералы",

    ordersHref: "/client/orders",

    ordersLabel: "Мои заказы",

  };

}



function navForPath(path: string): AppNavLinks | null {

  if (path.startsWith("/instructor")) return navForRole("INSTRUCTOR");

  if (path.startsWith("/admin")) return navForRole("ADMIN");

  if (path.startsWith("/client")) return navForRole("CLIENT");

  return null;

}



/**

 * Ссылки в шапке: для вошедшего пользователя — по роли в сессии (не по URL),

 * чтобы инструктор на /client не видел «Мои заказы» клиента.

 * Для гостя — по текущему пути.

 */

export function resolveAppNav(pathname: string | null, role?: UserRole | string): AppNavLinks {

  const path = pathname ?? "";



  if (role === "INSTRUCTOR" || role === "ADMIN" || role === "CLIENT") {

    return navForRole(role);

  }



  const byPath = navForPath(path);

  if (byPath) return byPath;



  return {

    area: "default",

    dashboardHref: "/client",

    dashboardLabel: "Кабинет",

    ordersHref: "/client/orders",

    ordersLabel: "Заказы",

  };

}



/** Пока useSession() ещё не подтянулся — угадываем кабинет по URL (только защищённые разделы). */
export function inferRoleFromProtectedPath(pathname: string | null): UserRole | undefined {
  const path = pathname ?? "";
  if (
    path.startsWith("/instructor") &&
    path !== "/instructor/login" &&
    path !== "/instructor/apply"
  ) {
    return "INSTRUCTOR";
  }
  if (path.startsWith("/admin") && path !== "/admin/login") {
    return "ADMIN";
  }
  if (path.startsWith("/client/orders") || path.startsWith("/client/registrations")) {
    return "CLIENT";
  }
  return undefined;
}

export function sessionConflictsWithNavArea(

  area: AppNavArea,

  role?: UserRole | string,

): boolean {

  if (!role) return false;

  if (area === "instructor") return role !== "INSTRUCTOR";

  if (area === "admin") return role !== "ADMIN";

  if (area === "client") return role !== "CLIENT";

  return false;

}

