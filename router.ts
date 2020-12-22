import { Validator, object, errorDebugString } from 'idonttrustlikethat'

interface Router<ROUTES extends Record<string, RouteDefinition<string, {}>>> {
  readonly definitions: ROUTES

  readonly route: RouteUnionFromDefinitions<RoutesWithNotFound<ROUTES>>
  readonly onChange: (callback: () => void) => Unsubscribe

  readonly push: <NAME extends keyof ROUTES>(
    routeName: NAME,
    params: SerializableValues<ROUTES[NAME]['validator']['T']>
  ) => void

  readonly replace: <NAME extends keyof ROUTES>(
    routeName: NAME,
    params: SerializableValues<ROUTES[NAME]['validator']['T']>
  ) => void

  readonly link: <NAME extends keyof ROUTES>(
    routeName: NAME,
    params: SerializableValues<ROUTES[NAME]['validator']['T']>
  ) => string
}

export function Route<PARAMS extends Validator<{}>>(
  path: string,
  params?: PARAMS
): { path: string; validator: PARAMS } {
  return { path, validator: params || ((object({}) as unknown) as PARAMS) }
}

export function Router<ROUTES extends Record<string, RouteDefinitionValue<{}>>>(
  definitions: ROUTES,
  options: Options
): Router<RouteValueToDefinition<ROUTES>> {
  const routes = Object.keys(definitions).reduce((acc, name) => {
    const route = definitions[name]
    acc[name] = { ...route, name, ...pathInfos(route.path) }
    return acc
  }, {} as Record<string, ParsedRouteDefinition<string, {}>>)

  const notFound = { name: 'notFound', params: {} }

  let subs: Function[] = []
  let _route = notFound

  setRouteFromHistory()
  addEventListener('popstate', () => {
    setRouteFromHistory()
    fireOnChange()
  })

  function setRouteFromHistory() {
    const path = location.pathname
    const search = location.search

    for (const parsedRoute of Object.values(routes)) {
      const match = parsedRoute.pattern.exec(path)
      if (!match) continue

      const stringParams = parsedRoute.keys.reduce<Record<string, string>>((params, key, index) => {
        params[key] = match[index + 1]
        return params
      }, parseQueryParams(search.slice(1)))

      const validatedParams = parsedRoute.validator.validate(stringParams)

      if (!validatedParams.ok) {
        return onRouteNotFound(
          'route match but params error. ' + errorDebugString(validatedParams.errors)
        )
      }

      return (_route = {
        name: parsedRoute.name,
        params: validatedParams.value
      })
    }

    onRouteNotFound('No match found')
  }

  const PARAMS = /:[^\\?\/]*/g
  function link(routeName: string, params: Record<string, string> = {}) {
    const routeToLink = routes[routeName]
    const path = routeToLink.path.replace(PARAMS, p => encodeURIComponent(params[p.substring(1)]))
    const query = Object.keys(params)
      .filter(p => !routeToLink.keys.includes(p) && params[p] !== undefined)
      .map(p => `${p}=${encodeURIComponent(params[p])}`)
      .join('&')
    return path + (query.length ? `?${query}` : '')
  }

  const push = changeRoute(false)
  const replace = changeRoute(true)

  function changeRoute(replace: boolean) {
    return (routeName: string, params: Record<string, any> = {}) => {
      const uri = link(routeName, params)

      if (replace) history.replaceState(uri, '', uri)
      else history.pushState(uri, '', uri)

      setRouteFromHistory()
      fireOnChange()
    }
  }

  function onChange(callback: () => void) {
    subs.push(callback)
    return () => {
      subs.splice(subs.indexOf(callback), 1)
    }
  }

  function fireOnChange() {
    subs.forEach(fn => fn())
  }

  function onRouteNotFound(reason: string) {
    // Set the route to notFound first, in case the onNotFound callback ends up redirecting to some other routes instead.
    _route = notFound
    options.onNotFound(reason)
    // if no redirect occured then fire onChange, otherwise it already fired from push/replace.
    if (_route.name === 'notFound') fireOnChange()
  }

  return ({
    get route() {
      return _route
    },
    definitions,
    onChange,
    push,
    replace,
    link
  } as any) as Router<RouteValueToDefinition<ROUTES>>
}

// Extracts a simple chain like /path/:id to a regexp and the list of path keys it found.
function pathInfos(str: string) {
  let tmp,
    keys = [],
    pattern = '',
    arr = str.split('/')

  arr[0] || arr.shift()

  while ((tmp = arr.shift())) {
    if (tmp[0] === ':') {
      keys.push(tmp.substring(1))
      pattern += '/([^/]+?)'
    } else {
      pattern += '/' + tmp
    }
  }

  return {
    keys,
    pattern: new RegExp('^' + pattern + '/?$', 'i')
  }
}

function parseQueryParams(query: string) {
  if (!query) return {}

  return query.split('&').reduce<Record<string, string>>((res, paramValue) => {
    const [param, value] = paramValue.split('=')
    res[param] = decodeURIComponent(value)
    return res
  }, {})
}

// A route as defined during router initialization.
interface RouteDefinitionValue<PARAMS extends {}> {
  path: string
  validator: Validator<PARAMS>
}

interface RouteDefinition<NAME, PARAMS extends {}> {
  name: NAME
  path: string
  validator: Validator<PARAMS>
}

type RouteValueToDefinition<ROUTES extends Record<string, RouteDefinitionValue<{}>>> = {
  [NAME in keyof ROUTES]: NAME extends string
    ? { name: NAME; path: string; validator: ROUTES[NAME]['validator'] }
    : never
}

interface ParsedRouteDefinition<NAME, PARAMS> extends RouteDefinition<NAME, PARAMS> {
  keys: string[]
  pattern: RegExp
}

interface CurrentRoute<NAME, PARAMS> {
  name: NAME
  params: PARAMS
}

interface Options {
  onNotFound: (reason: string) => void
}

type RouteUnionFromDefinitions<ROUTES extends Record<string, RouteDefinition<string, {}>>> = {
  [NAME in keyof ROUTES]: ROUTES[NAME] extends ROUTES[keyof ROUTES]
    ? CurrentRouteFromDefinition<ROUTES[NAME]>
    : never
}[keyof ROUTES]

type CurrentRouteFromDefinition<ROUTE extends RouteDefinition<string, {}>> = CurrentRoute<
  ROUTE['name'],
  ROUTE['validator']['T']
>

type Unsubscribe = () => void

type RoutesWithNotFound<ROUTES extends Record<string, RouteDefinition<string, {}>>> = ROUTES & {
  notFound: {
    name: 'notFound'
    path: ''
    validator: Validator<{}>
  }
}

type ValueOf<T> = T[keyof T]

type SerializableValues<T> = {
  [K in keyof T]: T[K] extends number | string | undefined ? T[K] : string
}

export type RouteParams<
  ROUTER extends Router<any>,
  NAME extends keyof ROUTER['definitions']
> = ROUTER['definitions'][NAME]['validator']['T']

type RouteAndParamsTemp<ROUTES extends Record<string, RouteDefinition<string, {}>>> = {
  [NAME in keyof ROUTES]: ROUTES[NAME] extends ROUTES[keyof ROUTES]
    ? [NAME, SerializableValues<ROUTES[NAME]['validator']['T']>]
    : never
}

// The union of all valid route name + params tuples that could be passed as arguments to push/replace/link
export type RouteAndParams<ROUTER extends Router<any>> = ValueOf<
  RouteAndParamsTemp<ROUTER['definitions']>
>
