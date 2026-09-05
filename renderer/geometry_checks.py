"""Reject source unions that radial inflation cannot represent faithfully."""
import math


def assert_star_union(polys, cx, cy, rays=256):
    """Require each sampled ray's polygon union to be one interval from origin.

    Coordinates use the source SVG convention (positive y down). The renderer
    samples these same rays after flipping y. Tangencies have zero area and are
    ignored; a small tolerance handles shared endpoints and sampled curves.
    """
    tolerance = 1e-6
    for index in range(rays):
        angle = 2 * math.pi * index / rays
        dx, dy = math.cos(angle), -math.sin(angle)
        intervals = []
        for polygon in polys:
            # Intersect the complete line through the origin, then pair sorted
            # crossings by the even-odd rule. Half-open edge crossing excludes
            # duplicate vertices without deleting legitimate close crossings.
            crossings = []
            for a, b in zip(polygon, polygon[1:] + polygon[:1]):
                ax, ay = a[0] - cx, a[1] - cy
                bx, by = b[0] - cx, b[1] - cy
                av, bv = dx * ay - dy * ax, dx * by - dy * bx
                if (av > 0) == (bv > 0):
                    continue
                fraction = av / (av - bv)
                x, y = ax + fraction * (bx - ax), ay + fraction * (by - ay)
                crossings.append(x * dx + y * dy)
            crossings.sort()
            for start, end in zip(crossings[::2], crossings[1::2]):
                start = max(0.0, start)
                if end - start > tolerance:
                    intervals.append((start, end))
        intervals.sort()
        reach = 0.0
        for start, end in intervals:
            if start > reach + tolerance:
                raise ValueError(
                    'Unsupported non-star-shaped source silhouette: radial '
                    f'inflation would fill an empty interval on ray {index}/{rays} '
                    f'({math.degrees(angle):.2f} degrees). Change the shape or '
                    'decoration settings; exact polygon-union inflation is not '
                    'implemented. No approximated render was produced.'
                )
            reach = max(reach, end)
        if reach <= tolerance:
            raise ValueError('Unsupported source silhouette: no body intersects a sampled ray.')
