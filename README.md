# typescript-router

A small and very typesafe router for `TypeScript`. Can be used with any client library/framework.

Route matching only occurs on the path portion of the url but query strings are all passed along (though multivalued query params aren't supported)

## API

### Create a new router

```ts
  // This is the validation library this router uses.
  import {string, number, isoDate} from 'idonttrustlikethat'
  import {Router, Route} from 'typescript-router'

  type UserId = string & { _tag: 'UserId' }
  const userId = string.tagged<UserId>()

  const router = Router(
    {
      index: Route('/'),
      users: Route('/users', object({ date: isoDate })),
      user: Route('/users/:id', object({ id: userId, q: number.optional() }))
    },
    { onNotFound }
  )

  function onNotFound(reason: string) {
    console.error(reason)
  }
```

### Finding out the current Route

The route is synchronously available on the router, after its creation.  
It is a type union discriminated by its name so you can use typescript to match and run behaviors based on that.  

```ts
if (router.route.name === 'users') {
  doSomethingWithIt(router.route.params.date)
}
```

### Subscribing to route changes

```ts
const unsubscribe = router.onChange(() => {
  console.log(router.route)
})
```

### Update the route

Note: when using `push`, `replace` or `link` the params value types are converted to strings or numbers because the router needs to concatenate those in the url.  
However, tagged strings keep their strong typing.   

```ts
router.push('users', {date: '2020-12-22T17:31:58.337Z'})
// router.route is now {name: 'users', params: {date: Date}}

// Or
router.replace('users', {date: '2020-12-22T17:31:58.337Z'}))
```

### Compute a link string ready to be used in anchors

```ts
const link = router.link('users', {date: '2020-12-22T17:31:58.337Z'})
// '/users?date=2020-12-22T17%3A31%3A58.337Z'
```

### Use the Router types

Two helper types are exported:

#### The type of a given route params

```ts
import {RouteParams} from 'typescript-router'

type AppRouter = typeof router
type UserRouteParams = RouteParams<AppRouter, 'users'> // {date: Date}
```

#### The type of all route name + serializable params combinations, as a tuple

```ts
import {RouteAndParams} from 'typescript-router'

type AppRouter = typeof router
type AppRouteParams = RouteAndParams<AppRouter>

// Is the same type as:

type Tuples =
  | ['index', {}]
  | ['users', { date: string }]
  | ['user', { id: UserId; q?: number | undefined }]
```